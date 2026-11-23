import { APP_TIMEZONE } from '@/lib/constants'
import { buildDateContext } from '@/lib/ai/datetime'
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

/** 期日が近いと判定する日数（今日を含めて何日先まで） */
const DUE_SOON_DAYS = 3

export type DueState = 'overdue' | 'soon' | 'later'

export interface DueInfo {
  state: DueState
  /** 今日からの日数（過去はマイナス） */
  days: number
  /** 今週（今日〜日曜）に含まれるか */
  thisWeek: boolean
}

/**
 * シートの日付文字列を YYYY-MM-DD に変換します。
 * 対応形式: 2026/11/20・2026-11-20・2026年11月20日・11/20・11月20日（年なしは今年とみなします）
 */
function parseSheetDate(value: string, currentYear: number): string | null {
  const text = value.trim()
  const full = text.match(/^(\d{4})[/\-年.](\d{1,2})[/\-月.](\d{1,2})/)
  const short = text.match(/^(\d{1,2})[/月](\d{1,2})/)
  const [year, month, day] = full
    ? [Number(full[1]), Number(full[2]), Number(full[3])]
    : short
      ? [currentYear, Number(short[1]), Number(short[2])]
      : [0, 0, 0]

  if (year === 0 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 期日の状態（期限切れ / 近い / 先）を判定します。日付として読めなければ null */
export function dueInfo(value: string | null | undefined, now: Date = new Date()): DueInfo | null {
  if (!value) {
    return null
  }
  const { today } = buildDateContext(now)
  const parsed = parseSheetDate(value, Number(today.slice(0, 4)))
  if (!parsed) {
    return null
  }

  const days = Math.round(
    (Date.parse(`${parsed}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  )
  // 今週の残り日数（日曜を週末とします）
  const daysToSunday = (7 - new Date(`${today}T00:00:00Z`).getUTCDay()) % 7

  return {
    state: days < 0 ? 'overdue' : days <= DUE_SOON_DAYS ? 'soon' : 'later',
    days,
    thisWeek: days >= 0 && days <= daysToSunday,
  }
}

/** 期日の補足表示（「期限切れ」「今日」「あと2日」など） */
export function describeDue(info: DueInfo): string {
  if (info.days < 0) return `${-info.days}日超過`
  if (info.days === 0) return '今日'
  if (info.days === 1) return '明日'
  return `あと${info.days}日`
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
