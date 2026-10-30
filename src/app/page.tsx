import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { loadDashboardSummary } from '@/lib/dashboard/summary'
import { AppShell } from '@/components/AppShell'
import { OrganizationSetup } from '@/components/OrganizationSetup'
import { Badge, Banner, Card, EmptyState, SectionTitle } from '@/components/ui'
import { BATCH_STATUS_LABEL, batchStatusTone, formatDateTime } from '@/lib/format'

/** ダッシュボード。最も目立つ位置に音声入力ボタンを配置します。 */
export default async function DashboardPage() {
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

  const summary = await loadDashboardSummary(auth.organizationId)

  return (
    <AppShell title="ダッシュボード" organizationName={auth.organizationName}>
      <div className="space-y-4">
        {!summary.isConfigured ? (
          <Banner tone="warning">
            シートの設定が完了していません。設定画面から Google 連携・シート選択・列マッピングを行ってください。
          </Banner>
        ) : null}

        <Link
          href="/voice"
          className="flex min-h-[120px] w-full items-center justify-center rounded-[3px] bg-[#0052cc] px-4 text-center text-xl font-bold text-white shadow-[0_1px_2px_rgba(9,30,66,0.25)] hover:bg-[#0065ff]"
        >
          🎤 進捗を音声入力
        </Link>

        <Card>
          <SectionTitle>連携中のスプレッドシート</SectionTitle>
          {summary.spreadsheet && summary.sheetConfig ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-[#172b4d]">{summary.spreadsheet.spreadsheet_name}</p>
              <p className="text-[#5e6c84]">
                シート: {summary.sheetConfig.sheet_name} / ヘッダー行: {summary.sheetConfig.header_row}
              </p>
              {summary.spreadsheet.spreadsheet_url ? (
                <a
                  href={summary.spreadsheet.spreadsheet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-[#0052cc] hover:underline"
                >
                  スプレッドシートを開く
                </a>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[#5e6c84]">未設定です</p>
          )}
          <div className="mt-3">
            <Link href="/settings" className="text-sm text-[#0052cc] hover:underline">
              設定を変更する
            </Link>
          </div>
        </Card>

        <Card>
          <SectionTitle>本日の更新数</SectionTitle>
          <p className="text-3xl font-bold text-[#172b4d]">
            {summary.todayUpdateCount}
            <span className="ml-1 text-base font-normal text-[#5e6c84]">セル</span>
          </p>
        </Card>

        <Card>
          <SectionTitle>最近の更新</SectionTitle>
          {summary.recentBatches.length === 0 ? (
            <EmptyState>まだ更新履歴がありません</EmptyState>
          ) : (
            <ul className="divide-y divide-[#dfe1e6]">
              {summary.recentBatches.map((batch) => (
                <li key={batch.id} className="py-2">
                  <Link
                    href={`/history/${batch.id}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-[#172b4d]">{formatDateTime(batch.created_at)}</span>
                    <Badge tone={batchStatusTone(batch.status)}>
                      {BATCH_STATUS_LABEL[batch.status]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Link href="/history" className="text-sm text-[#0052cc] hover:underline">
              更新履歴をすべて見る
            </Link>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
