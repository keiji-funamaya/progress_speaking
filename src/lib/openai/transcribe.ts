import { getOpenAI, TRANSCRIBE_MODEL } from '@/lib/openai/client'

/**
 * 音声文字起こし。
 * 音声ファイルは保存せず、文字起こし後に破棄します。
 */
export async function transcribeAudio(file: File): Promise<string> {
  const openai = getOpenAI()
  const result = await openai.audio.transcriptions.create({
    file,
    model: TRANSCRIBE_MODEL,
    language: 'ja',
  })
  return typeof result === 'string' ? result : (result.text ?? '')
}
