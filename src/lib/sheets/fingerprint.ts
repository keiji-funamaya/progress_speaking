import { createHash } from 'crypto'

/**
 * ヘッダー構造の変更検知。
 * 列の追加 / 削除 / 並べ替え / 名称変更を検知します。
 */

/** ヘッダー配列から fingerprint を生成します */
export function buildHeaderFingerprint(header: string[]): string {
  const normalized = header.map((name) => name.trim()).join('|')
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/** 保存済み fingerprint と現在のヘッダーを比較します */
export function isHeaderChanged(savedFingerprint: string | null, header: string[]): boolean {
  if (!savedFingerprint) {
    return false
  }
  return savedFingerprint !== buildHeaderFingerprint(header)
}

export const HEADER_CHANGED_MESSAGE =
  'スプレッドシートの構造が変更されています。列マッピングを確認してください。'
