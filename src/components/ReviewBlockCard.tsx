'use client'

import { ProjectCombobox } from '@/components/ProjectCombobox'
import { Badge, Banner, Button, Card, Label, Select, TextInput } from '@/components/ui'
import { displayValue } from '@/lib/format'
import type { AnalyzedBlock, ColumnMapping, ProjectRow, UpdateCandidate } from '@/lib/types'

/**
 * AI 解析結果の確認カード（1 案件分）。
 * 対象案件・対象列・更新値・反映有無をすべて手動変更できます。
 * 表示する列名は semantic type ではなく実際のシート列名です。
 */
export function ReviewBlockCard({
  block,
  projects,
  editableMappings,
  onChange,
}: {
  block: AnalyzedBlock
  projects: ProjectRow[]
  editableMappings: ColumnMapping[]
  onChange: (next: AnalyzedBlock) => void
}) {
  const selectedProject =
    projects.find((project) => project.rowNumber === block.matchedRowNumber) ?? null

  function patch(next: Partial<AnalyzedBlock>) {
    onChange({ ...block, ...next })
  }

  function patchCandidate(id: string, next: Partial<UpdateCandidate>) {
    patch({
      candidates: block.candidates.map((candidate) =>
        candidate.id === id ? { ...candidate, ...next } : candidate,
      ),
    })
  }

  /** 対象案件を変更したら、現在値もその案件の値へ差し替えます */
  function handleSelectProject(project: ProjectRow) {
    patch({
      matchedRowNumber: project.rowNumber,
      matchedLabel: project.label,
      identifier: project.identifier,
      needsManualSelection: false,
      enabled: true,
      candidates: block.candidates.map((candidate) => ({
        ...candidate,
        currentValue: project.values[candidate.columnIndex] ?? '',
      })),
    })
  }

  /** 更新対象の列を変更します（現在値も差し替えます） */
  function handleChangeColumn(candidateId: string, columnIndex: number) {
    const mapping = editableMappings.find((item) => item.column_index === columnIndex)
    if (!mapping) {
      return
    }
    patchCandidate(candidateId, {
      columnIndex: mapping.column_index,
      columnLetter: mapping.column_letter,
      columnName: mapping.column_name ?? mapping.column_letter,
      semanticType: mapping.semantic_type,
      currentValue: selectedProject?.values[mapping.column_index] ?? '',
    })
  }

  function handleAddCandidate() {
    const used = new Set(block.candidates.map((candidate) => candidate.columnIndex))
    const mapping = editableMappings.find((item) => !used.has(item.column_index))
    if (!mapping) {
      return
    }
    patch({
      candidates: [
        ...block.candidates,
        {
          id: `${block.id}-manual-${Date.now()}`,
          columnIndex: mapping.column_index,
          columnLetter: mapping.column_letter,
          columnName: mapping.column_name ?? mapping.column_letter,
          semanticType: mapping.semantic_type,
          currentValue: selectedProject?.values[mapping.column_index] ?? '',
          newValue: '',
          confidence: 1,
          enabled: true,
        },
      ],
    })
  }

  function handleRemoveCandidate(id: string) {
    patch({ candidates: block.candidates.filter((candidate) => candidate.id !== id) })
  }

  return (
    <Card className="space-y-4">
      <div>
        <Label>元の発言</Label>
        <p className="rounded-[3px] bg-[#f4f5f7] px-3 py-2 text-sm text-[#172b4d]">
          「{block.originalText}」
        </p>
      </div>

      {block.needsManualSelection ? (
        <Banner tone="warning">
          {block.matchedRowNumber === null
            ? '案件を特定できませんでした。対象案件を選択してください。'
            : `確信度が低いため自動確定していません（${Math.round(block.confidence * 100)}%）。対象案件を確認してください。`}
        </Banner>
      ) : null}

      <div>
        <Label>対象案件</Label>
        <ProjectCombobox
          projects={projects}
          selectedRowNumber={block.matchedRowNumber}
          onSelect={handleSelectProject}
        />
        {block.reason ? (
          <p className="mt-1 text-xs text-[#5e6c84]">
            AI の判断: {block.reason}（確信度 {Math.round(block.confidence * 100)}%）
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {block.candidates.length === 0 ? (
          <p className="text-sm text-[#5e6c84]">更新候補がありません</p>
        ) : (
          block.candidates.map((candidate) => (
            <div key={candidate.id} className="rounded-[3px] border border-[#dfe1e6] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#172b4d]">
                  <input
                    type="checkbox"
                    checked={candidate.enabled}
                    onChange={(e) => patchCandidate(candidate.id, { enabled: e.target.checked })}
                  />
                  {candidate.columnName}
                </label>
                <div className="flex items-center gap-2">
                  {candidate.confidence < 0.8 ? (
                    <Badge tone="warning">確信度 {Math.round(candidate.confidence * 100)}%</Badge>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs text-[#de350b] hover:underline"
                    onClick={() => handleRemoveCandidate(candidate.id)}
                  >
                    削除
                  </button>
                </div>
              </div>

              <Label>対象列</Label>
              <Select
                value={candidate.columnIndex}
                onChange={(e) => handleChangeColumn(candidate.id, Number(e.target.value))}
              >
                {editableMappings.map((mapping) => (
                  <option key={mapping.column_index} value={mapping.column_index}>
                    {mapping.column_name ?? mapping.column_letter}
                  </option>
                ))}
              </Select>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>現在</Label>
                  <p className="rounded-[3px] bg-[#f4f5f7] px-3 py-2 text-sm text-[#5e6c84]">
                    {displayValue(candidate.currentValue)}
                  </p>
                </div>
                <div>
                  <Label>変更後</Label>
                  <TextInput
                    value={candidate.newValue}
                    onChange={(e) => patchCandidate(candidate.id, { newValue: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))
        )}

        <Button
          variant="secondary"
          onClick={handleAddCandidate}
          disabled={block.candidates.length >= editableMappings.length}
        >
          ＋ 更新項目を追加
        </Button>
      </div>

      <label className="flex items-center gap-2 border-t border-[#dfe1e6] pt-3 text-sm font-semibold text-[#172b4d]">
        <input
          type="checkbox"
          checked={block.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
          disabled={block.matchedRowNumber === null}
        />
        この案件を反映する
      </label>
    </Card>
  )
}
