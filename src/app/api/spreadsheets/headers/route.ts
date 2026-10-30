import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthContext } from '@/lib/auth/context'
import { createAuthorizedClient, findGoogleConnection } from '@/lib/google/oauth'
import { createSheetsApi, fetchFormulaFlags, fetchHeaderAndSamples } from '@/lib/sheets/client'
import { columnIndexToLetter } from '@/lib/sheets/a1'
import { analyzeHeaders } from '@/lib/ai/headers'
import { createAdminSupabase } from '@/lib/supabase/server'
import { HEADER_SAMPLE_ROW_COUNT, MATCHING_SEMANTIC_TYPES } from '@/lib/constants'
import { handleApiError, jsonError, jsonOk } from '@/lib/api/response'

const bodySchema = z.object({
  spreadsheetConnectionId: z.string().uuid(),
  sheetName: z.string().min(1),
  headerRow: z.number().int().min(1),
})

/**
 * ヘッダー行とサンプルデータを取得し、AI で各列の意味を推定します。
 * 推定結果はここでは保存せず、確認画面へ返すだけです。
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext()
    const body = bodySchema.parse(await request.json())

    const admin = createAdminSupabase()
    const { data: connection } = await admin
      .from('spreadsheet_connections')
      .select('*')
      .eq('id', body.spreadsheetConnectionId)
      .eq('organization_id', auth.organizationId)
      .maybeSingle()

    if (!connection) {
      return jsonError('Spreadsheet 設定が見つかりません', 404)
    }

    const googleConnection = await findGoogleConnection(
      auth.organizationId,
      connection.google_connection_id,
    )
    if (!googleConnection) {
      return jsonError('Google アカウントが連携されていません', 400)
    }

    const sheetsApi = createSheetsApi(await createAuthorizedClient(googleConnection))
    const { header, samples } = await fetchHeaderAndSamples(
      sheetsApi,
      connection.spreadsheet_id,
      body.sheetName,
      body.headerRow,
      HEADER_SAMPLE_ROW_COUNT,
    )

    if (header.length === 0) {
      return jsonError('指定した行にヘッダーが見つかりませんでした', 400)
    }

    const formulaFlags = await fetchFormulaFlags(
      sheetsApi,
      connection.spreadsheet_id,
      body.sheetName,
      body.headerRow,
      header.length,
    )

    const analysis = await analyzeHeaders(header, samples)
    const semanticByIndex = new Map(
      analysis.columns.map((column) => [column.columnIndex, column]),
    )

    const columns = header.map((name, index) => {
      const suggestion = semanticByIndex.get(index)
      const semanticType = suggestion?.semanticType ?? 'other'
      const isFormula = formulaFlags[index] ?? false

      return {
        columnIndex: index,
        columnLetter: columnIndexToLetter(index),
        columnName: name,
        semanticType,
        confidence: suggestion?.confidence ?? 0,
        reason: suggestion?.reason ?? '',
        // 既定値。ユーザーが確認画面で変更できます。
        useForMatching: MATCHING_SEMANTIC_TYPES.includes(
          semanticType as (typeof MATCHING_SEMANTIC_TYPES)[number],
        ),
        aiEditable: !isFormula,
        readOnly: isFormula,
        isFormula,
      }
    })

    return jsonOk({ header, samples, columns })
  } catch (error) {
    return handleApiError(error)
  }
}
