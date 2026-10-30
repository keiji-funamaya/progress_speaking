import { requireAuthContext } from '@/lib/auth/context'
import { loadDataRows, loadSheetContext } from '@/lib/sheets/context'
import { buildProjectRows } from '@/lib/sheets/projects'
import { handleApiError, jsonOk } from '@/lib/api/response'

/**
 * 確認画面の案件選択 Combobox 用に、案件候補を返します。
 * organization に紐づく有効シートのみを対象にします。
 */
export async function GET() {
  try {
    const auth = await requireAuthContext()
    const context = await loadSheetContext(auth.organizationId)
    const rows = await loadDataRows(context)
    const projects = buildProjectRows(context.mappings, rows)

    return jsonOk({
      sheetConfigId: context.sheetConfig.id,
      sheetName: context.sheetConfig.sheet_name,
      mappings: context.mappings,
      projects,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
