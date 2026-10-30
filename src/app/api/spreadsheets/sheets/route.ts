import { type NextRequest } from 'next/server'
import { requireAuthContext } from '@/lib/auth/context'
import { createAuthorizedClient, findGoogleConnection } from '@/lib/google/oauth'
import { createSheetsApi, fetchSpreadsheetMeta } from '@/lib/sheets/client'
import { createAdminSupabase } from '@/lib/supabase/server'
import { handleApiError, jsonError, jsonOk } from '@/lib/api/response'

/** 登録済み Spreadsheet の Sheet 一覧を返します */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext()
    const spreadsheetConnectionId = request.nextUrl.searchParams.get('spreadsheetConnectionId')
    if (!spreadsheetConnectionId) {
      return jsonError('spreadsheetConnectionId が必要です', 400)
    }

    const admin = createAdminSupabase()
    const { data: connection } = await admin
      .from('spreadsheet_connections')
      .select('*')
      .eq('id', spreadsheetConnectionId)
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
    const meta = await fetchSpreadsheetMeta(sheetsApi, connection.spreadsheet_id)

    return jsonOk({ sheets: meta.sheets, title: meta.title })
  } catch (error) {
    return handleApiError(error)
  }
}
