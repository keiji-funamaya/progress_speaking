import { type NextRequest } from 'next/server'
import { requireAuthContext } from '@/lib/auth/context'
import { createAdminSupabase } from '@/lib/supabase/server'
import { handleApiError, jsonOk } from '@/lib/api/response'

/** 更新履歴を batch 単位で返します */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext()
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '30')

    const admin = createAdminSupabase()
    const { data: batches, error } = await admin
      .from('update_batches')
      .select('*')
      .eq('organization_id', auth.organizationId)
      .order('created_at', { ascending: false })
      .limit(Number.isFinite(limit) ? limit : 30)

    if (error) {
      throw new Error(`更新履歴の取得に失敗しました: ${error.message}`)
    }

    const batchIds = (batches ?? []).map((batch) => batch.id)
    const { data: logs } = batchIds.length
      ? await admin
          .from('sheet_update_logs')
          .select('*')
          .eq('organization_id', auth.organizationId)
          .in('update_batch_id', batchIds)
          .order('created_at', { ascending: true })
      : { data: [] }

    return jsonOk({ batches: batches ?? [], logs: logs ?? [] })
  } catch (error) {
    return handleApiError(error)
  }
}
