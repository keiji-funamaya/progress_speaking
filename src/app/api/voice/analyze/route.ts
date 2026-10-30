import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthContext } from '@/lib/auth/context'
import { loadDataRows, loadSheetContext } from '@/lib/sheets/context'
import { buildProjectRows } from '@/lib/sheets/projects'
import { splitTranscript } from '@/lib/ai/split'
import { analyzeBlock } from '@/lib/ai/analyze'
import { writableMappings } from '@/lib/validation/writable'
import { MATCH_CONFIDENCE_THRESHOLD, UPDATE_CONFIDENCE_THRESHOLD } from '@/lib/constants'
import { handleApiError, jsonError, jsonOk } from '@/lib/api/response'
import type { AnalyzedBlock, ColumnMapping, ProjectRow, UpdateCandidate } from '@/lib/types'

/**
 * 文字起こしテキストを解析し、確認画面用の更新候補を作ります。
 *
 * ここでは Google Sheets へ書き込みません。
 * また AI に物理列を決めさせず、semanticType -> 実列の変換はこの層で行います。
 */
export const maxDuration = 120

const bodySchema = z.object({
  transcript: z.string().min(1),
})

/** semanticType から書き込み可能な列を 1 つ選びます */
function findEditableMapping(
  mappings: ColumnMapping[],
  semanticType: string,
): ColumnMapping | undefined {
  return mappings.find((mapping) => mapping.semantic_type === semanticType)
}

/** AI の更新候補を確認画面用の候補へ変換します */
function buildCandidates(
  updates: { semanticType: string; value: string; confidence: number }[],
  editable: ColumnMapping[],
  matchedProject: ProjectRow | null,
  blockIndex: number,
): UpdateCandidate[] {
  const candidates: UpdateCandidate[] = []

  updates.forEach((update, updateIndex) => {
    const mapping = findEditableMapping(editable, update.semanticType)
    // 書き込み可能な列に対応しない semanticType は破棄します
    if (!mapping) {
      return
    }
    // 同じ列への重複候補は最初の 1 件のみ採用します
    if (candidates.some((candidate) => candidate.columnIndex === mapping.column_index)) {
      return
    }

    candidates.push({
      id: `b${blockIndex}-c${updateIndex}`,
      columnIndex: mapping.column_index,
      columnLetter: mapping.column_letter,
      columnName: mapping.column_name ?? mapping.column_letter,
      semanticType: mapping.semantic_type,
      currentValue: matchedProject?.values[mapping.column_index] ?? '',
      newValue: update.value,
      confidence: update.confidence,
      enabled: update.confidence >= UPDATE_CONFIDENCE_THRESHOLD,
    })
  })

  return candidates
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext()
    const { transcript } = bodySchema.parse(await request.json())

    const context = await loadSheetContext(auth.organizationId)
    const rows = await loadDataRows(context)
    const projects = buildProjectRows(context.mappings, rows)
    const editable = writableMappings(context.mappings)

    if (editable.length === 0) {
      return jsonError('AI が更新できる列が設定されていません。列マッピングを確認してください。', 400)
    }

    const texts = await splitTranscript(transcript)
    if (texts.length === 0) {
      return jsonError('発言から案件を抽出できませんでした', 400)
    }

    const blocks: AnalyzedBlock[] = []

    for (let index = 0; index < texts.length; index += 1) {
      const text = texts[index]
      const analysis = await analyzeBlock(text, projects, editable)

      const matchedRowNumber = Number(analysis.matchedCandidateId)
      const matchedProject =
        analysis.matchedCandidateId !== '' && Number.isFinite(matchedRowNumber)
          ? (projects.find((project) => project.rowNumber === matchedRowNumber) ?? null)
          : null

      // confidence が閾値未満、または案件を特定できない場合は自動確定しません
      const needsManualSelection =
        matchedProject === null || analysis.confidence < MATCH_CONFIDENCE_THRESHOLD

      blocks.push({
        id: `block-${index}`,
        originalText: text,
        matchedRowNumber: matchedProject?.rowNumber ?? null,
        matchedLabel: matchedProject?.label ?? null,
        identifier: matchedProject?.identifier ?? null,
        confidence: analysis.confidence,
        reason: analysis.reason,
        candidates: buildCandidates(analysis.updates, editable, matchedProject, index),
        enabled: !needsManualSelection,
        needsManualSelection,
      })
    }

    return jsonOk({
      sheetConfigId: context.sheetConfig.id,
      sheetName: context.sheetConfig.sheet_name,
      mappings: context.mappings,
      projects,
      blocks,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
