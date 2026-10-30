import { type NextRequest } from 'next/server'
import { requireAuthContext } from '@/lib/auth/context'
import { rollback } from '@/lib/updates/rollback'
import { handleApiError, jsonOk } from '@/lib/api/response'

/**
 * 1 回の反映単位（batch）の一括ロールバック。
 * 1 件でも競合がある場合は 1 件も実行せず、競合箇所を返します。
 */
export const maxDuration = 120

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const auth = await requireAuthContext()
    const { batchId } = await params

    const result = await rollback(auth, { batchId }, true)
    return jsonOk(result)
  } catch (error) {
    return handleApiError(error)
  }
}
