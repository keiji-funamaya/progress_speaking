import { blockAnalysisJsonSchema, blockAnalysisSchema, type BlockAnalysis } from '@/lib/ai/schemas'
import { requestStructured } from '@/lib/ai/structured'
import { buildDateContext, describeDateContext } from '@/lib/ai/datetime'
import { MAX_PROJECT_CANDIDATES, semanticTypeLabel } from '@/lib/constants'
import type { ColumnMapping, ProjectRow } from '@/lib/types'

/**
 * 1 ブロック（1 案件分の発言）について、
 *   - どの案件か
 *   - どの semanticType に
 *   - どんな値を入れるか
 * を推定します。
 *
 * AI には物理列（G列 / C42 など）を決めさせません。
 * semanticType -> 実列の変換はアプリ側で column_mappings を使って行います。
 */

function buildInstruction(editableMappings: ColumnMapping[]): string {
  const dateContext = describeDateContext(buildDateContext())

  const editableList = editableMappings
    .map(
      (mapping) =>
        `- ${mapping.semantic_type} (${semanticTypeLabel(mapping.semantic_type)} / シート列名: ${
          mapping.column_name ?? mapping.column_letter
        })`,
    )
    .join('\n')

  return [
    'あなたは業務進捗の口頭報告から、スプレッドシートの更新内容を作るアシスタントです。',
    '',
    '<user_data> には以下が含まれます:',
    '1. 担当者の発言（1 案件分）',
    '2. 案件候補リスト（candidateId 付き）',
    '',
    '## やること',
    '1. 発言がどの案件についてのものかを candidateId で 1 つ選ぶ',
    '2. 更新すべき項目を semanticType と値の組で返す',
    '',
    '## 案件特定のルール',
    '- 候補リストの中からのみ選んでください。',
    '- 確実に特定できない場合は matchedCandidateId を空文字 "" にし、confidence を 0.5 未満にしてください。',
    '- 同姓同名など複数候補がある場合も空文字にしてください。',
    '- confidence は 0.0〜1.0 で、根拠の強さを正直に反映してください。',
    '- reason には日本語で判断根拠を簡潔に書いてください。',
    '',
    '## 更新項目のルール',
    '- 使用できる semanticType は以下のみです:',
    editableList || '(更新可能な列がありません)',
    '- 発言から読み取れない項目は返さないでください。推測で埋めないでください。',
    '- value はスプレッドシートへそのまま入る文字列にしてください。',
    '- 日付は YYYY-MM-DD 形式にしてください。',
    '',
    '## 日時',
    dateContext,
  ].join('\n')
}

function buildUserData(blockText: string, candidates: ProjectRow[]): string {
  const candidateLines = candidates
    .slice(0, MAX_PROJECT_CANDIDATES)
    .map((candidate) => `candidateId=${candidate.rowNumber}: ${candidate.label}`)

  return [
    '## 発言',
    blockText,
    '',
    '## 案件候補リスト',
    ...(candidateLines.length > 0 ? candidateLines : ['(候補なし)']),
  ].join('\n')
}

export async function analyzeBlock(
  blockText: string,
  candidates: ProjectRow[],
  editableMappings: ColumnMapping[],
): Promise<BlockAnalysis> {
  return requestStructured({
    instruction: buildInstruction(editableMappings),
    userData: buildUserData(blockText, candidates),
    schemaName: 'block_analysis',
    jsonSchema: blockAnalysisJsonSchema,
    validator: blockAnalysisSchema,
  })
}
