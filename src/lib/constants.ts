/**
 * アプリ全体で共有する定数。
 * schema 名はここ 1 箇所だけで定義し、Supabase アクセス時は必ず参照します。
 */

/** 本システム専用の Supabase schema 名 */
export const APP_DB_SCHEMA = 'progress_speaking' as const

/** 日付解釈に使用するタイムゾーン */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'Asia/Tokyo'

/** 案件マッチングを自動確定してよい最低 confidence */
export const MATCH_CONFIDENCE_THRESHOLD = 0.8

/** 更新値を初期状態でチェック済みにしてよい最低 confidence */
export const UPDATE_CONFIDENCE_THRESHOLD = 0.6

/** AI へ渡す案件候補の最大件数（大量データをそのまま投げないため） */
export const MAX_PROJECT_CANDIDATES = 300

/** ヘッダー推定時に AI へ渡すサンプルデータ行数 */
export const HEADER_SAMPLE_ROW_COUNT = 5

/** 標準 semantic type の定義（label は UI 表示用） */
export const SEMANTIC_TYPES = [
  { value: 'project_id', label: '案件ID・案件番号' },
  { value: 'project_name', label: '案件名' },
  { value: 'customer_name', label: '顧客名・会社名' },
  { value: 'person_name', label: '担当者名（先方）' },
  { value: 'assignee', label: '自社担当' },
  { value: 'latest_progress', label: '最新進捗' },
  { value: 'last_action', label: '直前作業内容' },
  { value: 'last_action_date', label: '作業日' },
  { value: 'next_action', label: '次回アクション内容' },
  { value: 'next_action_date', label: 'アクション期日' },
  { value: 'status', label: '進捗状況' },
  { value: 'project_status', label: '案件状況' },
  { value: 'memo', label: '備考' },
  { value: 'other', label: 'その他' },
] as const

export type SemanticType = (typeof SEMANTIC_TYPES)[number]['value']

export const SEMANTIC_TYPE_VALUES = SEMANTIC_TYPES.map((t) => t.value) as SemanticType[]

/** semantic type から日本語ラベルを引きます */
export function semanticTypeLabel(value: string): string {
  return SEMANTIC_TYPES.find((t) => t.value === value)?.label ?? value
}

/** 案件特定に使う既定の semantic type */
export const MATCHING_SEMANTIC_TYPES: SemanticType[] = [
  'project_id',
  'project_name',
  'customer_name',
  'person_name',
  'assignee',
]

/** 日付として扱う semantic type */
export const DATE_SEMANTIC_TYPES: SemanticType[] = ['last_action_date', 'next_action_date']

/**
 * Google OAuth で要求するスコープ。
 *
 * Drive スコープは「制限付きスコープ」に分類され、本番公開時に
 * 第三者セキュリティ監査が必要になるため要求しません。
 * スプレッドシート名は Sheets API の spreadsheets.get から取得できます。
 */
export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
]
