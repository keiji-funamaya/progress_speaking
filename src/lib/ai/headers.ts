import { SEMANTIC_TYPES, SEMANTIC_TYPE_VALUES } from '@/lib/constants'
import { headerAnalysisJsonSchema, headerAnalysisSchema, type HeaderAnalysis } from '@/lib/ai/schemas'
import { requestStructured } from '@/lib/ai/structured'

/**
 * ヘッダー行とサンプルデータから各列の semantic type を推定します。
 * 推定結果はそのまま確定せず、必ずユーザーの確認画面を経由します。
 */

const INSTRUCTION = [
  'あなたは業務管理スプレッドシートの列の意味を推定するアシスタントです。',
  '<user_data> にはヘッダー行とサンプルデータが含まれます。',
  '各列について、最もふさわしい semanticType を 1 つ選んでください。',
  '',
  '選択できる semanticType は以下のみです:',
  SEMANTIC_TYPES.map((type) => `- ${type.value} : ${type.label}`).join('\n'),
  '',
  '判断できない列は "other" にしてください。',
  'columnIndex は <user_data> に記載された番号をそのまま使用してください。',
  'すべての列について 1 件ずつ返してください。',
].join('\n')

export async function analyzeHeaders(
  header: string[],
  samples: string[][],
): Promise<HeaderAnalysis> {
  const headerLines = header.map((name, index) => `columnIndex=${index}: ${name || '(空)'}`)
  const sampleLines = samples.map(
    (row, rowIndex) =>
      `サンプル${rowIndex + 1}: ${header
        .map((_, index) => `[${index}] ${row[index] ?? ''}`)
        .join(' | ')}`,
  )

  const result = await requestStructured({
    instruction: INSTRUCTION,
    userData: ['## ヘッダー', ...headerLines, '', '## サンプルデータ', ...sampleLines].join('\n'),
    schemaName: 'header_analysis',
    jsonSchema: headerAnalysisJsonSchema,
    validator: headerAnalysisSchema,
  })

  // AI が未知の semanticType を返した場合は other へ丸めます
  return {
    columns: result.columns.map((column) => ({
      ...column,
      semanticType: SEMANTIC_TYPE_VALUES.includes(
        column.semanticType as (typeof SEMANTIC_TYPE_VALUES)[number],
      )
        ? column.semanticType
        : 'other',
    })),
  }
}
