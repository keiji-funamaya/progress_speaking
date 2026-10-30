import OpenAI from 'openai'

/**
 * OpenAI クライアント。
 * OPENAI_API_KEY はサーバー側でのみ参照します。
 */

let cached: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY が設定されていません')
  }
  if (!cached) {
    cached = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return cached
}

export const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1'
export const ANALYZE_MODEL = process.env.OPENAI_ANALYZE_MODEL ?? 'gpt-4o-2024-08-06'
