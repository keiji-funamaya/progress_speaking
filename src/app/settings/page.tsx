import { redirect } from 'next/navigation'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { AppShell } from '@/components/AppShell'
import { OrganizationSetup } from '@/components/OrganizationSetup'
import { SettingsClient } from '@/components/SettingsClient'
import type { ColumnMapping, SheetConfig, SpreadsheetConnection } from '@/lib/types'

/**
 * 設定画面。
 * Google 連携 → Spreadsheet 登録 → Sheet 選択 → ヘッダー行 → 列マッピングまでを行います。
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>
}) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const auth = await getAuthContext()
  if (!auth) {
    return (
      <AppShell title="初期設定">
        <OrganizationSetup />
      </AppShell>
    )
  }

  const params = await searchParams
  const admin = createAdminSupabase()

  // refresh token などの秘密情報は含めず、表示に必要な項目のみ取得します
  const { data: googleConnection } = await admin
    .from('google_connections')
    .select('id, google_account_email, created_at')
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: spreadsheets } = await admin
    .from('spreadsheet_connections')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })

  const { data: sheetConfig } = await admin
    .from('sheet_configs')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: mappings } = sheetConfig
    ? await admin
        .from('column_mappings')
        .select('*')
        .eq('organization_id', auth.organizationId)
        .eq('sheet_config_id', sheetConfig.id)
        .order('column_index', { ascending: true })
    : { data: [] }

  return (
    <AppShell title="設定" organizationName={auth.organizationName} backHref="/">
      <SettingsClient
        googleEmail={googleConnection?.google_account_email ?? null}
        spreadsheets={(spreadsheets ?? []) as SpreadsheetConnection[]}
        sheetConfig={(sheetConfig as SheetConfig | null) ?? null}
        mappings={(mappings ?? []) as ColumnMapping[]}
        message={params.message ?? null}
        errorMessage={params.error ?? null}
      />
    </AppShell>
  )
}
