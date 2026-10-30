import { type NextRequest } from 'next/server'
import { requireAuthContext } from '@/lib/auth/context'
import { transcribeAudio } from '@/lib/openai/transcribe'
import { handleApiError, jsonError, jsonOk } from '@/lib/api/response'

/**
 * 音声を文字起こしします。
 * 音声ファイルは保存せず、レスポンス後に破棄されます。
 */
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    await requireAuthContext()

    const formData = await request.formData()
    const file = formData.get('audio')

    if (!(file instanceof File)) {
      return jsonError('音声ファイルが送信されていません', 400)
    }
    if (file.size === 0) {
      return jsonError('音声が録音されていません', 400)
    }

    const transcript = await transcribeAudio(file)
    return jsonOk({ transcript })
  } catch (error) {
    return handleApiError(error)
  }
}
