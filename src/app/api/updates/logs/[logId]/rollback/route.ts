import { type NextRequest } from 'next/server'
import { requireAuthContext } from '@/lib/auth/context'
import { rollback } from '@/lib/updates/rollback'
import { handleApiError, jsonOk } from '@/lib/api/response'

/**
 * 1 セル単位のロールバック。
 * 現在値が反映直後の値と異なる場合は競合として停止します。
 */
export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const auth = await requireAuthContext()
    const { logId } = await params

    const result = await rollback(auth, { logId }, false)
    return jsonOk(result)
  } catch (error) {
    return handleApiError(error)
  }
}
