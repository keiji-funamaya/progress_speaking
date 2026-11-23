'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ProjectSummaryCard,
  resolveSummaryColumns,
  summaryValue,
} from '@/components/ProjectSummaryCard'
import { Banner, EmptyState, TextInput } from '@/components/ui'
import { apiGet, toMessage } from '@/lib/api/fetcher'
import { dueInfo, formatDateTime } from '@/lib/format'
import type { ColumnMapping, ProjectRow } from '@/lib/types'

/**
 * 録音画面に表示する案件一覧（閲覧専用）。
 * 同じ画面内でスプシの中身を確認できるため、スクロールや検索をしても録音は止まりません。
 * 並び順は常に元のシートと同じ（行番号順）です。
 */

interface ProjectsResponse {
  sheetConfigId: string
  sheetName: string
  mappings: ColumnMapping[]
  projects: ProjectRow[]
}

type DueFilter = 'all' | 'overdue' | 'thisWeek'

/** 検索用に正規化します（空白除去・小文字化） */
function normalize(value: string): string {
  return value.replace(/[\s　]/g, '').toLowerCase()
}

export function ProjectBoard() {
  const [data, setData] = useState<ProjectsResponse | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    apiGet<ProjectsResponse>('/api/spreadsheets/projects')
      .then((response) => {
        setData(response)
        setFetchedAt(new Date().toISOString())
      })
      .catch((err) => setError(toMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo(() => resolveSummaryColumns(data?.mappings ?? []), [data])

  // シートの並び順（行番号順）を保ったまま、期日の状態を付けておきます
  const rows = useMemo(
    () =>
      [...(data?.projects ?? [])]
        .sort((a, b) => a.rowNumber - b.rowNumber)
        .map((project) => ({
          project,
          due: dueInfo(summaryValue(project, columns, 'next_action_date')),
          searchText: normalize(
            [
              project.label,
              summaryValue(project, columns, 'project_name'),
              summaryValue(project, columns, 'customer_name'),
              summaryValue(project, columns, 'project_id'),
            ].join(' '),
          ),
        })),
    [data, columns],
  )

  const overdueCount = rows.filter((row) => row.due?.state === 'overdue').length
  const thisWeekCount = rows.filter((row) => row.due?.thisWeek).length

  const keyword = normalize(query)
  const visibleRows = rows.filter((row) => {
    if (keyword !== '' && !row.searchText.includes(keyword)) return false
    if (dueFilter === 'overdue') return row.due?.state === 'overdue'
    if (dueFilter === 'thisWeek') return row.due?.thisWeek === true
    return true
  })

  const filterChips: { key: DueFilter; label: string; count: number; activeClass: string }[] = [
    { key: 'all', label: 'すべて', count: rows.length, activeClass: 'border-[#0052cc] bg-[#deebff] text-[#0747a6]' },
    { key: 'overdue', label: '期限切れ', count: overdueCount, activeClass: 'border-[#ffbdad] bg-[#ffebe6] text-[#bf2600]' },
    { key: 'thisWeek', label: '今週', count: thisWeekCount, activeClass: 'border-[#ffe380] bg-[#fffae6] text-[#974f0c]' },
  ]

  return (
    <section className="space-y-3">
      {/* 見出し + 再取得 */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#172b4d]">
            案件一覧
            {data ? (
              <span className="ml-2 text-sm font-normal text-[#5e6c84]">
                {visibleRows.length === rows.length
                  ? `${rows.length}件`
                  : `${visibleRows.length} / ${rows.length}件`}
              </span>
            ) : null}
          </h2>
          {data ? (
            <p className="truncate text-xs text-[#5e6c84]">
              {data.sheetName} ・ 取得 {formatDateTime(fetchedAt)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="shrink-0 rounded-[3px] px-2 py-1 text-sm font-medium text-[#0052cc] hover:bg-[#e9f2ff] disabled:text-[#a5adba]"
        >
          {loading ? '取得中...' : '↻ 最新にする'}
        </button>
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}

      {/* 検索 + 絞り込み */}
      <TextInput
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 案件名・顧客名・案件IDで検索"
        enterKeyHint="search"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setDueFilter(chip.key)}
            aria-pressed={dueFilter === chip.key}
            className={[
              'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              dueFilter === chip.key
                ? chip.activeClass
                : 'border-[#dfe1e6] bg-white text-[#42526e] hover:bg-[#f4f5f7]',
            ].join(' ')}
          >
            {chip.label} {chip.count}
          </button>
        ))}
      </div>

      {/* 一覧 */}
      {!data && loading ? <EmptyState>スプレッドシートを読み込んでいます...</EmptyState> : null}
      {data && visibleRows.length === 0 ? (
        <EmptyState>
          {rows.length === 0 ? '案件がありません' : '条件に合う案件がありません'}
        </EmptyState>
      ) : null}
      <div className="space-y-3">
        {data
          ? visibleRows.map((row) => (
              <ProjectSummaryCard
                key={row.project.rowNumber}
                project={row.project}
                mappings={data.mappings}
                columns={columns}
              />
            ))
          : null}
      </div>
    </section>
  )
}
