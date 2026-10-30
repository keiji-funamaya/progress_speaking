import { APP_TIMEZONE } from '@/lib/constants'

/**
 * AI へ渡す日時コンテキスト。
 * 「今日」「明日」「来週火曜」などを絶対日付へ変換させるために使用します。
 */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export interface DateContext {
  timezone: string
  /** YYYY-MM-DD */
  today: string
  /** 日本語の曜日 */
  weekday: string
  /** ISO 形式の現在時刻 */
  nowIso: string
}

export function buildDateContext(now: Date = new Date()): DateContext {
  // en-CA は YYYY-MM-DD 形式になります
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  // タイムゾーン上の日付から曜日を求めます
  const weekdayIndex = new Date(`${today}T00:00:00Z`).getUTCDay()

  return {
    timezone: APP_TIMEZONE,
    today,
    weekday: WEEKDAYS[weekdayIndex] ?? '',
    nowIso: now.toISOString(),
  }
}

/** プロンプトへ埋め込む文字列表現 */
export function describeDateContext(context: DateContext): string {
  return [
    `タイムゾーン: ${context.timezone}`,
    `今日の日付: ${context.today} (${context.weekday}曜日)`,
    '相対表現（今日 / 明日 / 明後日 / 来週火曜 / 25日 / 月末 など）は上記を基準に',
    'YYYY-MM-DD 形式の絶対日付へ変換してください。',
    '変換が曖昧な場合は断定せず confidence を下げてください。',
  ].join('\n')
}
