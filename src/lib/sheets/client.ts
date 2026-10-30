import { google, type sheets_v4 } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { cellRange, quoteSheetName, rowsRange } from '@/lib/sheets/a1'

/**
 * Google Sheets API の薄いラッパー。
 * 読み書きの入口をここに集約し、他モジュールでは googleapis を直接呼びません。
 */

export interface SheetMeta {
  sheetId: number
  sheetName: string
  index: number
  rowCount: number
  columnCount: number
}

export function createSheetsApi(auth: OAuth2Client): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth })
}

/** Spreadsheet URL から Spreadsheet ID を抽出します */
export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim()
  const matched = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (matched) {
    return matched[1]
  }
  // ID そのものが貼られた場合
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed
  }
  return null
}

/** Spreadsheet のメタ情報と Sheet 一覧を取得します */
export async function fetchSpreadsheetMeta(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<{ title: string; url: string; sheets: SheetMeta[] }> {
  const res = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields:
      'properties(title),spreadsheetUrl,sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))',
  })

  const sheets: SheetMeta[] = (res.data.sheets ?? []).map((sheet) => ({
    sheetId: sheet.properties?.sheetId ?? 0,
    sheetName: sheet.properties?.title ?? '',
    index: sheet.properties?.index ?? 0,
    rowCount: sheet.properties?.gridProperties?.rowCount ?? 0,
    columnCount: sheet.properties?.gridProperties?.columnCount ?? 0,
  }))

  return {
    title: res.data.properties?.title ?? '',
    url: res.data.spreadsheetUrl ?? '',
    sheets,
  }
}

/** 指定範囲の表示値を 2 次元配列で取得します */
export async function fetchValues(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  })
  return (res.data.values ?? []).map((row) => row.map((cell) => String(cell ?? '')))
}

/** ヘッダー行と後続のサンプル行を取得します */
export async function fetchHeaderAndSamples(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  headerRow: number,
  sampleCount: number,
): Promise<{ header: string[]; samples: string[][] }> {
  const range = rowsRange(sheetName, headerRow, headerRow + sampleCount)
  const values = await fetchValues(sheetsApi, spreadsheetId, range)
  const [header = [], ...samples] = values
  return { header, samples }
}

/** ヘッダー行より下の全データ行を取得します */
export async function fetchDataRows(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  headerRow: number,
): Promise<{ rowNumber: number; cells: string[] }[]> {
  const range = rowsRange(sheetName, headerRow + 1)
  const values = await fetchValues(sheetsApi, spreadsheetId, range)
  return values.map((cells, i) => ({ rowNumber: headerRow + 1 + i, cells }))
}

/** 単一セルの現在値を取得します */
export async function fetchCellValue(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  columnIndex: number,
): Promise<string> {
  const values = await fetchValues(
    sheetsApi,
    spreadsheetId,
    cellRange(sheetName, rowNumber, columnIndex),
  )
  return values[0]?.[0] ?? ''
}

/** 複数セルの現在値をまとめて取得します（返り値は range と同じ順序） */
export async function fetchCellValues(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  targets: { sheetName: string; rowNumber: number; columnIndex: number }[],
): Promise<string[]> {
  if (targets.length === 0) {
    return []
  }
  const ranges = targets.map((t) => cellRange(t.sheetName, t.rowNumber, t.columnIndex))
  const res = await sheetsApi.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  })
  return (res.data.valueRanges ?? []).map((vr) => String(vr.values?.[0]?.[0] ?? ''))
}

/**
 * 対象セルだけを更新します。
 * 行全体の上書きは行いません。
 */
export async function updateCell(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  columnIndex: number,
  value: string,
): Promise<void> {
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: cellRange(sheetName, rowNumber, columnIndex),
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  })
}

/** 指定セルが数式かどうかを判定します（数式列の自動検出用） */
export async function fetchFormulaFlags(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  headerRow: number,
  columnCount: number,
): Promise<boolean[]> {
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(sheetName)}!A${headerRow + 1}:${headerRow + 20}`,
    valueRenderOption: 'FORMULA',
  })
  const rows = res.data.values ?? []
  const flags = new Array<boolean>(columnCount).fill(false)
  rows.forEach((row) => {
    row.forEach((cell, columnIndex) => {
      if (columnIndex < columnCount && typeof cell === 'string' && cell.startsWith('=')) {
        flags[columnIndex] = true
      }
    })
  })
  return flags
}
