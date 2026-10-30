import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthContext } from '@/lib/auth/context'
import { findGoogleConnection, createAuthorizedClient } from '@/lib/google/oauth'
import { createSheetsApi, extractSpreadsheetId, fetchSpreadsheetMeta } from '@/lib/sheets/client'
import { createAdminSupabase } from '@/lib/supabase/server'
import { handleApiError, jsonError, jsonOk } from '@/lib/api/response'

const bodySchema = z.object({
  url: z.string().min(1),
})

/** Spreadsheet URL を登録し、Sheet 一覧を返します */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext()
    const { url } = bodySchema.parse(await request.json())

    const spreadsheetId = extractSpreadsheetId(url)
    if (!spreadsheetId) {
      return jsonError('Spreadsheet URL から ID を取得できませんでした', 400)
    }

    const connection = await findGoogleConnection(auth.organizationId)
    if (!connection) {
      return jsonError('先に Google アカウントを連携してください', 400)
    }

    const client = await createAuthorizedClient(connection)
    const sheetsApi = createSheetsApi(client)
    const meta = await fetchSpreadsheetMeta(sheetsApi, spreadsheetId)

    const admin = createAdminSupabase()
    const { data: existing } = await admin
      .from('spreadsheet_connections')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('spreadsheet_id', spreadsheetId)
      .maybeSingle()

    const payload = {
      organization_id: auth.organizationId,
      google_connection_id: connection.id,
      spreadsheet_id: spreadsheetId,
      spreadsheet_name: meta.title,
      spreadsheet_url: meta.url,
    }

    let spreadsheetConnectionId: string
    if (existing) {
      await admin
        .from('spreadsheet_connections')
        .update(payload)
        .eq('id', existing.id)
        .eq('organization_id', auth.organizationId)
      spreadsheetConnectionId = existing.id
    } else {
      const { data: inserted, error } = await admin
        .from('spreadsheet_connections')
        .insert(payload)
        .select('id')
        .single()
      if (error || !inserted) {
        return jsonError(`Spreadsheet の登録に失敗しました: ${error?.message}`, 500)
      }
      spreadsheetConnectionId = inserted.id
    }

    return jsonOk({
      spreadsheetConnectionId,
      spreadsheetId,
      title: meta.title,
      url: meta.url,
      sheets: meta.sheets,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
