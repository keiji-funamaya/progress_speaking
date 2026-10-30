/**
 * A1 記法まわりの共通ユーティリティ。
 * 列 index（0 始まり）と列文字の相互変換をここへ集約します。
 */

/** 0 -> "A", 25 -> "Z", 26 -> "AA" */
export function columnIndexToLetter(index: number): string {
  if (index < 0) {
    throw new Error(`列 index が不正です: ${index}`)
  }
  let result = ''
  let current = index
  while (current >= 0) {
    result = String.fromCharCode((current % 26) + 65) + result
    current = Math.floor(current / 26) - 1
  }
  return result
}

/** "A" -> 0, "AA" -> 26 */
export function columnLetterToIndex(letter: string): number {
  const upper = letter.toUpperCase()
  let result = 0
  for (let i = 0; i < upper.length; i += 1) {
    const code = upper.charCodeAt(i) - 64
    if (code < 1 || code > 26) {
      throw new Error(`列文字が不正です: ${letter}`)
    }
    result = result * 26 + code
  }
  return result - 1
}

/** シート名を A1 記法で安全に使えるようクォートします */
export function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`
}

/** 単一セルの A1 range を作ります（例: 'シート1'!C42） */
export function cellRange(sheetName: string, rowNumber: number, columnIndex: number): string {
  return `${quoteSheetName(sheetName)}!${columnIndexToLetter(columnIndex)}${rowNumber}`
}

/** 行範囲の A1 range を作ります（例: 'シート1'!A5:Z1000） */
export function rowsRange(
  sheetName: string,
  startRow: number,
  endRow?: number,
  lastColumnIndex = 51,
): string {
  const lastLetter = columnIndexToLetter(lastColumnIndex)
  const end = endRow ? `${lastLetter}${endRow}` : lastLetter
  return `${quoteSheetName(sheetName)}!A${startRow}:${end}`
}
