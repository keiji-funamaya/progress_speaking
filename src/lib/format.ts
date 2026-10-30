import { APP_TIMEZONE } from '@/lib/constants'
import type { BatchStatus, LogStatus } from '@/lib/types'

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
