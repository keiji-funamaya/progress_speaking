import { createAdminSupabase } from '@/lib/supabase/server'
import { APP_TIMEZONE } from '@/lib/constants'
import type { SheetConfig, SpreadsheetConnection, UpdateBatch } from '@/lib/types'

/**
 * ダッシュボード表示用の集計。
 * organization_id を必ず条件に含めます。
 */

export interface DashboardSummary {
  spreadsheet: SpreadsheetConnection | null
  sheetConfig: SheetConfig | null
  todayUpdateCount: number
  recentBatches: UpdateBatch[]
  isConfigured: boolean
  hasGoogleConnection: boolean
}

/** タイムゾーン上の「今日 0 時」を ISO 文字列で返します */
function startOfTodayIso(): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  // Asia/Tokyo (+09:00) を前提としたオフセット指定
  return new Date(`${today}T00:00:00+09:00`).toISOString()
}

export async function loadDashboardSummary(organizationId: string): Promise<DashboardSummary> {
  const admin = createAdminSupabase()

  const { data: googleConnection } = await admin
    .from('google_connections')
    .select('id')
    .eq('organization_id', organizationId)
    .limit(1)
    .maybeSingle()

  const { data: sheetConfig } = await admin
    .from('sheet_configs')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: spreadsheet } = sheetConfig
    ? await admin
        .from('spreadsheet_connections')
        .select('*')
        .eq('id', sheetConfig.spreadsheet_connection_id)
        .eq('organization_id', organizationId)
        .maybeSingle()
    : { data: null }

  const { count: todayUpdateCount } = await admin
    .from('sheet_update_logs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'applied')
    .gte('created_at', startOfTodayIso())

  const { data: recentBatches } = await admin
    .from('update_batches')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(5)

  return {
    spreadsheet: (spreadsheet as SpreadsheetConnection | null) ?? null,
    sheetConfig: (sheetConfig as SheetConfig | null) ?? null,
    todayUpdateCount: todayUpdateCount ?? 0,
    recentBatches: (recentBatches ?? []) as UpdateBatch[],
    isConfigured: Boolean(sheetConfig),
    hasGoogleConnection: Boolean(googleConnection),
  }
}
