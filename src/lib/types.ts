/**
 * アプリ全体で共有する型定義。
 * DB のテーブル構造とほぼ 1:1 で対応させています。
 */

export type MemberRole = 'owner' | 'admin' | 'member'

export type BatchStatus =
  | 'pending'
  | 'applying'
  | 'applied'
  | 'partially_failed'
  | 'failed'
  | 'reverted'
  | 'partially_reverted'

export type LogStatus =
  | 'pending'
  | 'applied'
  | 'failed'
  | 'reverted'
  | 'rollback_failed'
  | 'conflict'

export type VerificationStatus = 'pending' | 'verified' | 'failed'

export interface Organization {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: MemberRole
  created_at: string
}

export interface GoogleConnection {
  id: string
  organization_id: string
  user_id: string
  google_account_email: string
  refresh_token: string | null
  access_token: string | null
  token_expires_at: string | null
  scopes: string[]
  created_at: string
  updated_at: string
}

/** クライアントへ返してよい Google 接続情報（token を含めません） */
export type SafeGoogleConnection = Pick<
  GoogleConnection,
  'id' | 'organization_id' | 'google_account_email' | 'scopes' | 'created_at' | 'updated_at'
>

export interface SpreadsheetConnection {
  id: string
  organization_id: string
  google_connection_id: string
  spreadsheet_id: string
  spreadsheet_name: string | null
  spreadsheet_url: string | null
  created_at: string
  updated_at: string
}

export interface SheetConfig {
  id: string
  organization_id: string
  spreadsheet_connection_id: string
  sheet_id: number
  sheet_name: string
  header_row: number
  header_fingerprint: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CustomSemanticField {
  id: string
  organization_id: string
  key: string
  label: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface ColumnMapping {
  id: string
  organization_id: string
  sheet_config_id: string
  column_index: number
  column_letter: string
  column_name: string | null
  semantic_type: string
  custom_semantic_field_id: string | null
  use_for_matching: boolean
  ai_editable: boolean
  read_only: boolean
  is_formula: boolean
  created_at: string
  updated_at: string
}

export interface UpdateBatch {
  id: string
  organization_id: string
  user_id: string
  spreadsheet_connection_id: string | null
  sheet_config_id: string | null
  source_type: 'voice' | 'manual'
  status: BatchStatus
  created_at: string
  reverted_at: string | null
  reverted_by: string | null
}

/**
 * 案件の識別情報。
 * 行番号は並び替えで変わるため永久 ID にはせず、
 * 列名 -> 値 の組み合わせで反映直前に再検索します。
 */
export interface ProjectIdentifier {
  /** 一意 ID 列（案件番号など）がある場合の値 */
  primaryKeyColumnIndex?: number
  primaryKeyColumnName?: string
  primaryKeyValue?: string
  /** 一意 ID が無い場合に使用する複合キー */
  fields: { columnIndex: number; columnName: string; value: string }[]
  /** 解析時点の行番号（参考値。信用せず再検索します） */
  observedRowNumber?: number
}

export interface SheetUpdateLog {
  id: string
  organization_id: string
  update_batch_id: string
  user_id: string
  spreadsheet_id: string
  sheet_id: number
  sheet_name: string
  project_identifier: ProjectIdentifier
  row_number: number
  column_index: number
  column_letter: string
  column_name: string | null
  old_value: string | null
  new_value: string | null
  status: LogStatus
  verification_status: VerificationStatus
  error_message: string | null
  created_at: string
  reverted_at: string | null
  reverted_by: string | null
}

/** Sheet から読み出した 1 案件（1 行）の表現 */
export interface ProjectRow {
  rowNumber: number
  /** 列 index -> セル表示値 */
  values: Record<number, string>
  /** Combobox 表示用ラベル */
  label: string
  identifier: ProjectIdentifier
}

/** 確認画面で扱う 1 セル分の更新候補 */
export interface UpdateCandidate {
  /** クライアント側で一意にするための ID */
  id: string
  columnIndex: number
  columnLetter: string
  columnName: string
  semanticType: string
  currentValue: string
  newValue: string
  confidence: number
  enabled: boolean
}

/** 確認画面で扱う 1 案件分のブロック */
export interface AnalyzedBlock {
  id: string
  originalText: string
  matchedRowNumber: number | null
  matchedLabel: string | null
  identifier: ProjectIdentifier | null
  confidence: number
  reason: string
  candidates: UpdateCandidate[]
  enabled: boolean
  /** confidence 不足などで手動選択が必要か */
  needsManualSelection: boolean
}

/** /api/updates/apply へ送る 1 セル分のペイロード */
export interface ApplyCellPayload {
  columnIndex: number
  newValue: string
  /** 確認画面表示時点の値。反映直前の現在値と照合します。 */
  observedOldValue: string
}

/** /api/updates/apply へ送る 1 案件分のペイロード */
export interface ApplyProjectPayload {
  identifier: ProjectIdentifier
  cells: ApplyCellPayload[]
}

/** 反映結果 1 セル分 */
export interface ApplyCellResult {
  columnIndex: number
  columnLetter: string
  columnName: string | null
  rowNumber: number | null
  oldValue: string | null
  newValue: string | null
  status: LogStatus
  verificationStatus: VerificationStatus
  message: string | null
  projectLabel: string
}

/** ロールバック結果 1 セル分 */
export interface RollbackCellResult {
  logId: string
  status: LogStatus
  message: string | null
  currentValue: string | null
  expectedValue: string | null
  restoredValue: string | null
}
