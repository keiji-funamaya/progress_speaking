import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthContext } from '@/lib/auth/context'
import { createAdminSupabase } from '@/lib/supabase/server'
import { buildHeaderFingerprint } from '@/lib/sheets/fingerprint'
import { handleApiError, jsonError, jsonOk } from '@/lib/api/response'

const columnSchema = z.object({
  columnIndex: z.number().int().min(0),
  columnLetter: z.string().min(1),
  columnName: z.string(),
  semanticType: z.string().min(1),
  useForMatching: z.boolean(),
  aiEditable: z.boolean(),
  readOnly: z.boolean(),
  isFormula: z.boolean(),
})

const bodySchema = z.object({
  spreadsheetConnectionId: z.string().uuid(),
  sheetId: z.number().int(),
  sheetName: z.string().min(1),
  headerRow: z.number().int().min(1),
  header: z.array(z.string()),
  columns: z.array(columnSchema).min(1),
})

/**
 * ユーザーが確認・修正した列マッピングを保存します。
 * 同時に sheet_config を作成／更新し、header_fingerprint を保存します。
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext()
    const body = bodySchema.parse(await request.json())
    const admin = createAdminSupabase()

    const { data: connection } = await admin
      .from('spreadsheet_connections')
      .select('id')
      .eq('id', body.spreadsheetConnectionId)
      .eq('organization_id', auth.organizationId)
      .maybeSingle()

    if (!connection) {
      return jsonError('Spreadsheet 設定が見つかりません', 404)
    }

    const configPayload = {
      organization_id: auth.organizationId,
      spreadsheet_connection_id: body.spreadsheetConnectionId,
      sheet_id: body.sheetId,
      sheet_name: body.sheetName,
      header_row: body.headerRow,
      header_fingerprint: buildHeaderFingerprint(body.header),
      is_active: true,
    }

    const { data: existingConfig } = await admin
      .from('sheet_configs')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('spreadsheet_connection_id', body.spreadsheetConnectionId)
      .eq('sheet_id', body.sheetId)
      .maybeSingle()

    let sheetConfigId: string
    if (existingConfig) {
      await admin
        .from('sheet_configs')
        .update(configPayload)
        .eq('id', existingConfig.id)
        .eq('organization_id', auth.organizationId)
      sheetConfigId = existingConfig.id
    } else {
      const { data: inserted, error } = await admin
        .from('sheet_configs')
        .insert(configPayload)
        .select('id')
        .single()
      if (error || !inserted) {
        return jsonError(`シート設定の保存に失敗しました: ${error?.message}`, 500)
      }
      sheetConfigId = inserted.id
    }

    // 同一シートの他設定を無効化し、有効なシートを 1 つに保ちます
    await admin
      .from('sheet_configs')
      .update({ is_active: false })
      .eq('organization_id', auth.organizationId)
      .neq('id', sheetConfigId)

    // 列マッピングは全置き換えします（列の増減へ追従するため）
    await admin
      .from('column_mappings')
      .delete()
      .eq('organization_id', auth.organizationId)
      .eq('sheet_config_id', sheetConfigId)

    const { error: mappingError } = await admin.from('column_mappings').insert(
      body.columns.map((column) => ({
        organization_id: auth.organizationId,
        sheet_config_id: sheetConfigId,
        column_index: column.columnIndex,
        column_letter: column.columnLetter,
        column_name: column.columnName,
        semantic_type: column.semanticType,
        use_for_matching: column.useForMatching,
        ai_editable: column.aiEditable,
        read_only: column.readOnly,
        is_formula: column.isFormula,
      })),
    )

    if (mappingError) {
      return jsonError(`列マッピングの保存に失敗しました: ${mappingError.message}`, 500)
    }

    return jsonOk({ sheetConfigId })
  } catch (error) {
    return handleApiError(error)
  }
}
