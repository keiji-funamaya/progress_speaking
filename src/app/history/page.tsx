import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { AppShell } from '@/components/AppShell'
import { Badge, Card, EmptyState } from '@/components/ui'
import { BATCH_STATUS_LABEL, batchStatusTone, displayValue, formatDateTime } from '@/lib/format'
import type { SheetUpdateLog, UpdateBatch } from '@/lib/types'

/** 更新履歴一覧（batch 単位） */
export default async function HistoryPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const auth = await getAuthContext()
  if (!auth) {
    redirect('/')
  }

  const admin = createAdminSupabase()
  const { data: batchRows } = await admin
    .from('update_batches')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })
    .limit(30)

  const batches = (batchRows ?? []) as UpdateBatch[]
  const batchIds = batches.map((batch) => batch.id)

  const { data: logRows } = batchIds.length
    ? await admin
        .from('sheet_update_logs')
        .select('*')
        .eq('organization_id', auth.organizationId)
        .in('update_batch_id', batchIds)
        .order('created_at', { ascending: true })
    : { data: [] }

  const logs = (logRows ?? []) as SheetUpdateLog[]

  return (
    <AppShell title="更新履歴" organizationName={auth.organizationName} backHref="/">
      {batches.length === 0 ? (
        <EmptyState>まだ更新履歴がありません</EmptyState>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const batchLogs = logs.filter((log) => log.update_batch_id === batch.id)
            return (
              <Card key={batch.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#172b4d]">
                    {formatDateTime(batch.created_at)}
                  </span>
                  <Badge tone={batchStatusTone(batch.status)}>
                    {BATCH_STATUS_LABEL[batch.status]}
                  </Badge>
                </div>
                <p className="mb-2 text-sm text-[#5e6c84]">
                  {batch.source_type === 'voice' ? '音声進捗報告' : '手動更新'} ／{' '}
                  {batchLogs.length}セル更新
                </p>

                <ul className="mb-3 space-y-1 text-sm text-[#42526e]">
                  {batchLogs.slice(0, 3).map((log) => (
                    <li key={log.id}>
                      {log.column_name ?? log.column_letter}: {displayValue(log.old_value)} →{' '}
                      {displayValue(log.new_value)}
                    </li>
                  ))}
                  {batchLogs.length > 3 ? (
                    <li className="text-[#5e6c84]">ほか {batchLogs.length - 3} 件</li>
                  ) : null}
                </ul>

                <Link href={`/history/${batch.id}`} className="text-sm text-[#0052cc] hover:underline">
                  詳細を見る / 元に戻す
                </Link>
              </Card>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
