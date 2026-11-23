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

/** 初期表示で選択しておく案件状況 */
const DEFAULT_PROJECT_STATUS = '進行中'

/** 案件状況が空の案件をまとめる表示名 */
const EMPTY_STATUS_LABEL = '(未設定)'

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
  /** 選択中の案件状況（null = まだ操作していない → 初期値を使います。空配列 = 全件） */
  const [selectedStatuses, setSelectedStatuses] = useState<string[] | null>(null)

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
          status: summaryValue(project, columns, 'project_status') || EMPTY_STATUS_LABEL,
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

  // 案件状況の選択肢（シートに最初に出てきた順）と件数
  const statusOptions = useMemo(() => {
    const counts = new Map<string, number>()
    rows.forEach((row) => counts.set(row.status, (counts.get(row.status) ?? 0) + 1))
    return [...counts.entries()].map(([value, count]) => ({ value, count }))
  }, [rows])

  // 未操作の間は「進行中」を選択（シートに無ければ全件）
  const activeStatuses =
    selectedStatuses ??
    (statusOptions.some((option) => option.value === DEFAULT_PROJECT_STATUS)
      ? [DEFAULT_PROJECT_STATUS]
      : [])

  function toggleStatus(value: string) {
    setSelectedStatuses(
      activeStatuses.includes(value)
        ? activeStatuses.filter((item) => item !== value)
        : [...activeStatuses, value],
    )
  }

  // 案件状況で絞った後の案件（期日ボタンの件数もこれを基準にします）
  const statusRows =
    activeStatuses.length === 0 ? rows : rows.filter((row) => activeStatuses.includes(row.status))

  const overdueCount = statusRows.filter((row) => row.due?.state === 'overdue').length
  const thisWeekCount = statusRows.filter((row) => row.due?.thisWeek).length

  const keyword = normalize(query)
  const visibleRows = statusRows.filter((row) => {
    if (keyword !== '' && !row.searchText.includes(keyword)) return false
    if (dueFilter === 'overdue') return row.due?.state === 'overdue'
    if (dueFilter === 'thisWeek') return row.due?.thisWeek === true
    return true
  })

  const filterChips: { key: DueFilter; label: string; count: number; activeClass: string }[] = [
    { key: 'all', label: 'すべて', count: statusRows.length, activeClass: 'border-[#0052cc] bg-[#deebff] text-[#0747a6]' },
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
      {columns.project_status && statusOptions.length > 0 ? (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-[#5e6c84]">
            {columns.project_status.column_name ?? '案件状況'}
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusOptions.map((option) => {
              const selected = activeStatuses.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleStatus(option.value)}
                  aria-pressed={selected}
                  className={[
                    'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    selected
                      ? 'border-[#0052cc] bg-[#deebff] text-[#0747a6]'
                      : 'border-[#dfe1e6] bg-white text-[#42526e] hover:bg-[#f4f5f7]',
                  ].join(' ')}
                >
                  {selected ? '✓ ' : ''}
                  {option.value} {option.count}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-[#5e6c84]">期日</span>
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
