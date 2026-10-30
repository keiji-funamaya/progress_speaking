import { MATCHING_SEMANTIC_TYPES } from '@/lib/constants'
import type { ColumnMapping, ProjectIdentifier, ProjectRow } from '@/lib/types'

/**
 * Sheet の行データを「案件」として扱うためのモジュール。
 *
 * 行番号は並び替えで変わるため永久 ID にしません。
 * 案件番号などの一意 ID を優先し、無ければ複数列の組み合わせで識別します。
 */

/** 案件特定に使う列を決めます（明示設定が無ければ semantic type から推定） */
export function resolveMatchingColumns(mappings: ColumnMapping[]): ColumnMapping[] {
  const explicit = mappings.filter((m) => m.use_for_matching)
  if (explicit.length > 0) {
    return explicit
  }
  return mappings.filter((m) =>
    MATCHING_SEMANTIC_TYPES.includes(m.semantic_type as (typeof MATCHING_SEMANTIC_TYPES)[number]),
  )
}

/** 一意 ID 列（案件番号など）を探します */
function findPrimaryKeyColumn(mappings: ColumnMapping[]): ColumnMapping | null {
  return mappings.find((m) => m.semantic_type === 'project_id') ?? null
}

/** 1 行分の識別情報を組み立てます */
export function buildIdentifier(
  mappings: ColumnMapping[],
  cells: string[],
  rowNumber: number,
): ProjectIdentifier {
  const matchingColumns = resolveMatchingColumns(mappings)
  const primaryKey = findPrimaryKeyColumn(mappings)
  const primaryValue = primaryKey ? (cells[primaryKey.column_index] ?? '').trim() : ''

  return {
    primaryKeyColumnIndex: primaryValue ? primaryKey?.column_index : undefined,
    primaryKeyColumnName: primaryValue ? (primaryKey?.column_name ?? undefined) : undefined,
    primaryKeyValue: primaryValue || undefined,
    fields: matchingColumns
      .map((column) => ({
        columnIndex: column.column_index,
        columnName: column.column_name ?? column.column_letter,
        value: (cells[column.column_index] ?? '').trim(),
      }))
      .filter((field) => field.value !== ''),
    observedRowNumber: rowNumber,
  }
}

/** Combobox 等で使う表示ラベルを作ります（同姓同名でも区別できるように複数列を連結） */
export function buildProjectLabel(mappings: ColumnMapping[], cells: string[]): string {
  const matchingColumns = resolveMatchingColumns(mappings)
  const parts = matchingColumns
    .map((column) => (cells[column.column_index] ?? '').trim())
    .filter((value) => value !== '')
  return parts.length > 0 ? parts.join(' / ') : '(空行)'
}

/** データ行から案件候補リストを作ります */
export function buildProjectRows(
  mappings: ColumnMapping[],
  rows: { rowNumber: number; cells: string[] }[],
): ProjectRow[] {
  const matchingColumns = resolveMatchingColumns(mappings)

  return rows
    .filter((row) =>
      matchingColumns.some((column) => (row.cells[column.column_index] ?? '').trim() !== ''),
    )
    .map((row) => {
      const values: Record<number, string> = {}
      mappings.forEach((mapping) => {
        values[mapping.column_index] = row.cells[mapping.column_index] ?? ''
      })
      return {
        rowNumber: row.rowNumber,
        values,
        label: buildProjectLabel(mappings, row.cells),
        identifier: buildIdentifier(mappings, row.cells, row.rowNumber),
      }
    })
}

/** 値の比較用に正規化します（全角空白・前後空白・大文字小文字を吸収） */
function normalize(value: string): string {
  return value.replace(/[\s　]/g, '').toLowerCase()
}

/**
 * 識別情報から現在の行番号を再検索します。
 * 反映直前・ロールバック直前に必ず呼び、解析時の行番号を信用しません。
 *
 * 戻り値:
 *   rowNumber   : 一意に特定できた行番号
 *   candidates  : 複数該当した場合の候補行番号
 */
export function findRowByIdentifier(
  identifier: ProjectIdentifier,
  rows: { rowNumber: number; cells: string[] }[],
): { rowNumber: number | null; candidates: number[] } {
  // 1) 一意 ID 列があれば最優先
  if (identifier.primaryKeyValue && identifier.primaryKeyColumnIndex !== undefined) {
    const columnIndex = identifier.primaryKeyColumnIndex
    const target = normalize(identifier.primaryKeyValue)
    const hits = rows.filter(
      (row) => normalize(row.cells[columnIndex] ?? '') === target && target !== '',
    )
    if (hits.length === 1) {
      return { rowNumber: hits[0].rowNumber, candidates: [hits[0].rowNumber] }
    }
    if (hits.length > 1) {
      return { rowNumber: null, candidates: hits.map((h) => h.rowNumber) }
    }
  }

  // 2) 複合キーの全一致
  const fields = identifier.fields.filter((field) => field.value !== '')
  if (fields.length === 0) {
    return { rowNumber: null, candidates: [] }
  }

  const hits = rows.filter((row) =>
    fields.every((field) => normalize(row.cells[field.columnIndex] ?? '') === normalize(field.value)),
  )

  if (hits.length === 1) {
    return { rowNumber: hits[0].rowNumber, candidates: [hits[0].rowNumber] }
  }
  return { rowNumber: null, candidates: hits.map((h) => h.rowNumber) }
}

/** 識別情報を人が読める文字列にします（エラー表示用） */
export function describeIdentifier(identifier: ProjectIdentifier): string {
  if (identifier.primaryKeyValue) {
    return `${identifier.primaryKeyColumnName ?? 'ID'}: ${identifier.primaryKeyValue}`
  }
  const parts = identifier.fields.map((field) => `${field.columnName}: ${field.value}`)
  return parts.length > 0 ? parts.join(' / ') : '(識別情報なし)'
}
