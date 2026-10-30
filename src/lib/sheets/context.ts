import type { sheets_v4 } from 'googleapis'
import { createAdminSupabase } from '@/lib/supabase/server'
import { getAuthorizedClientForOrganization } from '@/lib/google/oauth'
import { createSheetsApi, fetchDataRows, fetchHeaderAndSamples } from '@/lib/sheets/client'
import { buildHeaderFingerprint, HEADER_CHANGED_MESSAGE } from '@/lib/sheets/fingerprint'
import type { ColumnMapping, SheetConfig, SpreadsheetConnection } from '@/lib/types'

/**
 * シート操作に必要な情報を一括で読み込む共通モジュール。
 *
 * organization_id を必ず条件に含めることで、
 * RLS を使わずにテナント分離を担保します。
 */

export interface SheetContext {
  sheetsApi: sheets_v4.Sheets
  spreadsheetConnection: SpreadsheetConnection
  sheetConfig: SheetConfig
  mappings: ColumnMapping[]
}

/** 有効な sheet_config を 1 件取得します（id 指定が無ければ最新の有効設定） */
export async function loadSheetContext(
  organizationId: string,
  sheetConfigId?: string,
): Promise<SheetContext> {
  const admin = createAdminSupabase()

  let configQuery = admin
    .from('sheet_configs')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)

  if (sheetConfigId) {
    configQuery = configQuery.eq('id', sheetConfigId)
  }

  const { data: sheetConfig, error: configError } = await configQuery.maybeSingle()
  if (configError) {
    throw new Error(`シート設定の取得に失敗しました: ${configError.message}`)
  }
  if (!sheetConfig) {
    throw new Error('使用するシートが設定されていません。設定画面から登録してください。')
  }

  const { data: connection, error: connectionError } = await admin
    .from('spreadsheet_connections')
    .select('*')
    .eq('id', sheetConfig.spreadsheet_connection_id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (connectionError) {
    throw new Error(`Spreadsheet 設定の取得に失敗しました: ${connectionError.message}`)
  }
  if (!connection) {
    throw new Error('Spreadsheet 設定が見つかりません')
  }

  const { data: mappings, error: mappingError } = await admin
    .from('column_mappings')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('sheet_config_id', sheetConfig.id)
    .order('column_index', { ascending: true })

  if (mappingError) {
    throw new Error(`列マッピングの取得に失敗しました: ${mappingError.message}`)
  }

  const auth = await getAuthorizedClientForOrganization(
    organizationId,
    connection.google_connection_id,
  )

  return {
    sheetsApi: createSheetsApi(auth),
    spreadsheetConnection: connection as SpreadsheetConnection,
    sheetConfig: sheetConfig as SheetConfig,
    mappings: (mappings ?? []) as ColumnMapping[],
  }
}

/**
 * ヘッダー構造が保存時から変わっていないかを検証します。
 * 変わっている場合は例外を投げ、更新処理を停止します。
 */
export async function assertHeaderUnchanged(context: SheetContext): Promise<void> {
  const { header } = await fetchHeaderAndSamples(
    context.sheetsApi,
    context.spreadsheetConnection.spreadsheet_id,
    context.sheetConfig.sheet_name,
    context.sheetConfig.header_row,
    0,
  )

  const saved = context.sheetConfig.header_fingerprint
  if (saved && saved !== buildHeaderFingerprint(header)) {
    throw new Error(HEADER_CHANGED_MESSAGE)
  }
}

/** ヘッダー行より下の全データ行を取得します */
export async function loadDataRows(context: SheetContext) {
  return fetchDataRows(
    context.sheetsApi,
    context.spreadsheetConnection.spreadsheet_id,
    context.sheetConfig.sheet_name,
    context.sheetConfig.header_row,
  )
}
