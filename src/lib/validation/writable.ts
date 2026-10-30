import type { ColumnMapping } from '@/lib/types'

/**
 * 書き込み可否の判定。
 *
 * AI が更新候補を出しても、最終的な更新権限は DB の column_mappings を正とします。
 * AI の出力や画面からの入力は信用せず、必ずここでサーバー側再検証します。
 */

export interface WritableCheckResult {
  writable: boolean
  reason: string | null
}

export function checkWritable(mapping: ColumnMapping | undefined): WritableCheckResult {
  if (!mapping) {
    return { writable: false, reason: '列マッピングが存在しません' }
  }
  if (mapping.read_only) {
    return { writable: false, reason: '読み取り専用列です' }
  }
  if (mapping.is_formula) {
    return { writable: false, reason: '数式列です' }
  }
  if (!mapping.ai_editable) {
    return { writable: false, reason: '更新禁止列です' }
  }
  return { writable: true, reason: null }
}

/** 書き込み可能な列マッピングだけを抽出します */
export function writableMappings(mappings: ColumnMapping[]): ColumnMapping[] {
  return mappings.filter((mapping) => checkWritable(mapping).writable)
}

/** 列 index からマッピングを引く Map を作ります */
export function mappingByColumnIndex(mappings: ColumnMapping[]): Map<number, ColumnMapping> {
  return new Map(mappings.map((mapping) => [mapping.column_index, mapping]))
}
