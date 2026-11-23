'use client'

import { useState } from 'react'
import { Badge, Card, Label } from '@/components/ui'
import { describeDue, displayValue, dueInfo } from '@/lib/format'
import type { ColumnMapping, ProjectRow } from '@/lib/types'

/**
 * 録音画面で「スプシの中身を見ながら話す」ための案件カード（1 案件分・閲覧専用）。
 * 列の semantic type から、話すときに必要な項目だけを決まった位置に並べます。
 * 割り当てのない列は「すべての項目」を開いたときだけ表示します。
 */

/** カードの決まった位置に表示する semantic type */
const SUMMARY_TYPES = [
  'project_name',
  'customer_name',
  'project_id',
  'status',
  'project_status',
  'latest_progress',
  'next_action',
  'next_action_date',
  'assignee',
] as const

type SummaryType = (typeof SUMMARY_TYPES)[number]

export type SummaryColumns = Partial<Record<SummaryType, ColumnMapping>>

/** semantic type ごとに最初の列を割り当てます */
export function resolveSummaryColumns(mappings: ColumnMapping[]): SummaryColumns {
  const columns: SummaryColumns = {}
  SUMMARY_TYPES.forEach((type) => {
    const mapping = mappings.find((item) => item.semantic_type === type)
    if (mapping) {
      columns[type] = mapping
    }
  })
  return columns
}

/** 指定した semantic type の値を取り出します（列がない・空なら空文字） */
export function summaryValue(
  project: ProjectRow,
  columns: SummaryColumns,
  type: SummaryType,
): string {
  const mapping = columns[type]
  return mapping ? (project.values[mapping.column_index] ?? '').trim() : ''
}

export function ProjectSummaryCard({
  project,
  mappings,
  columns,
}: {
  project: ProjectRow
  mappings: ColumnMapping[]
  columns: SummaryColumns
}) {
  const [expanded, setExpanded] = useState(false)

  const value = (type: SummaryType) => summaryValue(project, columns, type)

  const title = value('project_name') || project.label
  const subParts = [value('customer_name'), value('project_id')].filter((part) => part !== '')
  const statuses = [value('status'), value('project_status')].filter((part) => part !== '')
  const latestProgress = value('latest_progress')
  const nextAction = value('next_action')
  const nextDate = value('next_action_date')
  const assignee = value('assignee')
  const due = dueInfo(nextDate)

  // カード上部に出している列は「すべての項目」から除きます
  const shownIndexes = new Set(
    Object.values(columns).map((mapping) => mapping.column_index),
  )
  const otherMappings = mappings
    .filter((mapping) => !shownIndexes.has(mapping.column_index))
    .sort((a, b) => a.column_index - b.column_index)

  return (
    <Card className="space-y-3">
      {/* 見出し: 案件名 + 状況 */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug break-words text-[#172b4d]">
            {title}
          </h3>
          {statuses.length > 0 ? (
            <div className="flex shrink-0 flex-col items-end gap-1">
              {statuses.map((status, index) => (
                <Badge key={index} tone="info">
                  <span className="block max-w-[8rem] truncate">{status}</span>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {subParts.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-[#5e6c84]">{subParts.join(' ・ ')}</p>
        ) : null}
      </div>

      {/* 最新進捗 */}
      {columns.latest_progress ? (
        <div className="border-t border-[#ebecf0] pt-3">
          <Label>{columns.latest_progress.column_name ?? '最新進捗'}</Label>
          <p
            className={[
              'text-sm whitespace-pre-wrap break-words text-[#42526e]',
              expanded ? '' : 'line-clamp-2',
            ].join(' ')}
          >
            {displayValue(latestProgress)}
          </p>
        </div>
      ) : null}

      {/* 次回アクション + 期日 */}
      {columns.next_action || columns.next_action_date ? (
        <div className="border-t border-[#ebecf0] pt-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#5e6c84]">次回</span>
            {nextDate ? (
              <span
                className={[
                  'text-sm font-semibold',
                  due?.state === 'overdue'
                    ? 'text-[#bf2600]'
                    : due?.state === 'soon'
                      ? 'text-[#974f0c]'
                      : 'text-[#172b4d]',
                ].join(' ')}
              >
                {nextDate}
              </span>
            ) : (
              <span className="text-sm text-[#5e6c84]">期日なし</span>
            )}
            {due && due.state !== 'later' ? (
              <Badge tone={due.state === 'overdue' ? 'error' : 'warning'}>
                {describeDue(due)}
              </Badge>
            ) : null}
          </div>
          {columns.next_action ? (
            <p
              className={[
                'text-sm whitespace-pre-wrap break-words text-[#42526e]',
                expanded ? '' : 'line-clamp-2',
              ].join(' ')}
            >
              {displayValue(nextAction)}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* すべての項目（開閉） */}
      {expanded && otherMappings.length > 0 ? (
        <dl className="space-y-2 border-t border-[#ebecf0] pt-3">
          {otherMappings.map((mapping) => (
            <div key={mapping.column_index}>
              <dt className="text-xs font-semibold text-[#5e6c84]">
                {mapping.column_name ?? mapping.column_letter}
              </dt>
              <dd className="text-sm whitespace-pre-wrap break-words text-[#42526e]">
                {displayValue(project.values[mapping.column_index])}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* フッター: 担当 + 開閉ボタン */}
      <div className="flex items-center justify-between gap-2 border-t border-[#ebecf0] pt-2">
        <span className="min-w-0 truncate text-xs text-[#5e6c84]">
          {assignee ? `担当: ${assignee}` : `${project.rowNumber}行目`}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="shrink-0 rounded-[3px] px-2 py-1 text-xs font-medium text-[#0052cc] hover:bg-[#e9f2ff]"
          aria-expanded={expanded}
        >
          {expanded ? '▲ 閉じる' : '▼ すべての項目'}
        </button>
      </div>
    </Card>
  )
}
