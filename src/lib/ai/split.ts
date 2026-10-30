import { splitJsonSchema, splitSchema } from '@/lib/ai/schemas'
import { requestStructured } from '@/lib/ai/structured'

/**
 * 文字起こしテキストを案件単位のブロックへ分割します。
 * 単純な句点区切りではなく、文脈で判断させます。
 */

const INSTRUCTION = [
  'あなたは業務進捗報告の音声文字起こしを、案件ごとに分割するアシスタントです。',
  '<user_data> は担当者が複数案件についてまとめて話した内容です。',
  '',
  'ルール:',
  '- 1 つの案件について話している範囲を 1 ブロックとしてください。',
  '- 句点だけで機械的に区切らず、文脈で判断してください。',
  '- 同じ案件について複数文にわたって話している場合は 1 ブロックにまとめてください。',
  '- 発言内容は要約せず、元の文をそのまま originalText に入れてください。',
  '- 案件と無関係な雑談・言い直しは除外して構いません。',
  '- 案件が 1 件だけの場合は 1 ブロックを返してください。',
].join('\n')

export async function splitTranscript(transcript: string): Promise<string[]> {
  const trimmed = transcript.trim()
  if (trimmed === '') {
    return []
  }

  const result = await requestStructured({
    instruction: INSTRUCTION,
    userData: trimmed,
    schemaName: 'transcript_split',
    jsonSchema: splitJsonSchema,
    validator: splitSchema,
  })

  return result.blocks.map((block) => block.originalText.trim()).filter((text) => text !== '')
}
