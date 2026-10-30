import { notFound, redirect } from 'next/navigation'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { AppShell } from '@/components/AppShell'
import { HistoryDetailClient } from '@/components/HistoryDetailClient'
import type { SheetUpdateLog, UpdateBatch } from '@/lib/types'

/** 更新履歴詳細 / ロールバック確認 */
export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>
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
    redirect('/')
  }

  const { batchId } = await params
  const admin = createAdminSupabase()

  // organization_id を条件に含め、他組織の履歴を参照できないようにします
  const { data: batch } = await admin
    .from('update_batches')
    .select('*')
    .eq('id', batchId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!batch) {
    notFound()
  }

  const { data: logs } = await admin
    .from('sheet_update_logs')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .eq('update_batch_id', batchId)
    .order('created_at', { ascending: true })

  return (
    <AppShell title="更新履歴詳細" organizationName={auth.organizationName} backHref="/history">
      <HistoryDetailClient
        batch={batch as UpdateBatch}
        logs={(logs ?? []) as SheetUpdateLog[]}
      />
    </AppShell>
  )
}
