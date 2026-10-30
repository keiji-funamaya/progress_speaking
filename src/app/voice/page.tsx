import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/context'
import { loadDashboardSummary } from '@/lib/dashboard/summary'
import { AppShell } from '@/components/AppShell'
import { VoiceClient } from '@/components/VoiceClient'
import { Banner } from '@/components/ui'

/** 音声入力画面 */
export default async function VoicePage() {
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

  const summary = await loadDashboardSummary(auth.organizationId)

  return (
    <AppShell title="音声入力" organizationName={auth.organizationName} backHref="/">
      {summary.isConfigured ? (
        <VoiceClient />
      ) : (
        <Banner tone="warning">
          シートの設定が完了していません。設定画面から Google 連携・シート選択・列マッピングを行ってください。
        </Banner>
      )}
    </AppShell>
  )
}
