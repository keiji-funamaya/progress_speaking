import { APP_TIMEZONE } from '@/lib/constants'
import type {
  BatchStatus,
  CellFormat,
  ColumnMapping,
  HorizontalAlign,
  LogStatus,
} from '@/lib/types'

/** 表示フォーマットの共通関数 */

export function formatDateTime(iso: string | null): string {
  if (!iso) {
    return '-'
  }
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  pending: '未反映',
  applying: '反映中',
  applied: '反映済み',
  partially_failed: '一部失敗',
  failed: '失敗',
  reverted: '元に戻し済み',
  partially_reverted: '一部を元に戻し済み',
}

export const LOG_STATUS_LABEL: Record<LogStatus, string> = {
  pending: '未反映',
  applied: '反映済み',
  failed: '失敗',
  reverted: '元に戻し済み',
  rollback_failed: 'ロールバック失敗',
  conflict: '競合',
}

export function batchStatusTone(status: BatchStatus): 'success' | 'warning' | 'error' | 'info' {
  if (status === 'applied') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'partially_failed') return 'warning'
  return 'info'
}

export function logStatusTone(status: LogStatus): 'success' | 'warning' | 'error' | 'info' {
  if (status === 'applied') return 'success'
  if (status === 'failed' || status === 'rollback_failed') return 'error'
  if (status === 'conflict') return 'warning'
  return 'info'
}

/** 空文字を「(空)」として表示します */
export function displayValue(value: string | null | undefined): string {
  return value && value !== '' ? value : '(空)'
}

export const HORIZONTAL_ALIGN_LABEL: Record<HorizontalAlign, string> = {
  LEFT: '左揃え',
  CENTER: '中央揃え',
  RIGHT: '右揃え',
}

/** 書式の項目が 1 つでも指定されているかを判定します */
export function hasCellFormat(format: CellFormat | null | undefined): format is CellFormat {
  return (
    !!format &&
    (format.textColor !== null || format.horizontalAlign !== null || format.bold !== null)
  )
}

/** 書式の内容を「赤文字・中央揃え・太字」のような短い文で表します */
export function describeCellFormat(format: CellFormat | null | undefined): string {
  if (!hasCellFormat(format)) {
    return '書式変更なし'
  }
  const parts: string[] = []
  if (format.textColor !== null) {
    parts.push(`文字色 ${format.textColor}`)
  }
  if (format.horizontalAlign !== null) {
    parts.push(HORIZONTAL_ALIGN_LABEL[format.horizontalAlign])
  }
  if (format.bold) {
    parts.push('太字')
  }
  return parts.join('・')
}

/** 列の事前設定から反映時の書式を作ります（何も設定されていなければ null） */
export function formatFromMapping(mapping: ColumnMapping | undefined): CellFormat | null {
  if (!mapping) {
    return null
  }
  const format: CellFormat = {
    textColor: mapping.write_text_color,
    horizontalAlign: mapping.write_horizontal_align,
    bold: mapping.write_bold ? true : null,
  }
  return hasCellFormat(format) ? format : null
}
