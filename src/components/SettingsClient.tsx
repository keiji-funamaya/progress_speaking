'use client'

import { useState } from 'react'
import { apiGet, apiPost, toMessage } from '@/lib/api/fetcher'
import { SEMANTIC_TYPES } from '@/lib/constants'
import { Banner, Button, Card, Label, SectionTitle, Select, TextInput } from '@/components/ui'
import type { ColumnMapping, SheetConfig, SpreadsheetConnection } from '@/lib/types'

/**
 * 設定画面の本体。
 * 顧客ごとにシート構造が異なるため、コード変更なしで設定だけで使えるようにします。
 */

interface SheetOption {
  sheetId: number
  sheetName: string
}

/** 列マッピング確認画面で編集する 1 列分の状態 */
interface ColumnDraft {
  columnIndex: number
  columnLetter: string
  columnName: string
  semanticType: string
  confidence: number
  reason: string
  useForMatching: boolean
  aiEditable: boolean
  readOnly: boolean
  isFormula: boolean
}

interface Props {
  googleEmail: string | null
  spreadsheets: SpreadsheetConnection[]
  sheetConfig: SheetConfig | null
  mappings: ColumnMapping[]
  message: string | null
  errorMessage: string | null
}

export function SettingsClient({
  googleEmail,
  spreadsheets,
  sheetConfig,
  mappings,
  message,
  errorMessage,
}: Props) {
  const [url, setUrl] = useState(spreadsheets[0]?.spreadsheet_url ?? '')
  const [spreadsheetConnectionId, setSpreadsheetConnectionId] = useState<string | null>(
    spreadsheets[0]?.id ?? null,
  )
  const [sheetOptions, setSheetOptions] = useState<SheetOption[]>([])
  const [selectedSheet, setSelectedSheet] = useState<SheetOption | null>(
    sheetConfig ? { sheetId: sheetConfig.sheet_id, sheetName: sheetConfig.sheet_name } : null,
  )
  const [headerRow, setHeaderRow] = useState(sheetConfig?.header_row ?? 1)
  const [header, setHeader] = useState<string[]>([])
  const [samples, setSamples] = useState<string[][]>([])
  const [columns, setColumns] = useState<ColumnDraft[]>(
    mappings.map((mapping) => ({
      columnIndex: mapping.column_index,
      columnLetter: mapping.column_letter,
      columnName: mapping.column_name ?? '',
      semanticType: mapping.semantic_type,
      confidence: 1,
      reason: '保存済みの設定',
      useForMatching: mapping.use_for_matching,
      aiEditable: mapping.ai_editable,
      readOnly: mapping.read_only,
      isFormula: mapping.is_formula,
    })),
  )

  const [status, setStatus] = useState<string | null>(message)
  const [error, setError] = useState<string | null>(errorMessage)
  const [loading, setLoading] = useState<string | null>(null)

  function run(key: string, task: () => Promise<void>) {
    setLoading(key)
    setError(null)
    task()
      .catch((err) => setError(toMessage(err)))
      .finally(() => setLoading(null))
  }

  function handleConnectSpreadsheet() {
    run('connect', async () => {
      const data = await apiPost<{
        spreadsheetConnectionId: string
        title: string
        sheets: SheetOption[]
      }>('/api/spreadsheets/connect', { url })
      setSpreadsheetConnectionId(data.spreadsheetConnectionId)
      setSheetOptions(data.sheets)
      setStatus(`「${data.title}」を登録しました。使用するシートを選択してください。`)
    })
  }

  function handleLoadSheets() {
    if (!spreadsheetConnectionId) {
      return
    }
    run('sheets', async () => {
      const data = await apiGet<{ sheets: SheetOption[] }>(
        `/api/spreadsheets/sheets?spreadsheetConnectionId=${spreadsheetConnectionId}`,
      )
      setSheetOptions(data.sheets)
    })
  }

  function handleAnalyzeHeader() {
    if (!spreadsheetConnectionId || !selectedSheet) {
      return
    }
    run('header', async () => {
      const data = await apiPost<{
        header: string[]
        samples: string[][]
        columns: ColumnDraft[]
      }>('/api/spreadsheets/headers', {
        spreadsheetConnectionId,
        sheetName: selectedSheet.sheetName,
        headerRow,
      })
      setHeader(data.header)
      setSamples(data.samples)
      setColumns(data.columns)
      setStatus('AI が列の意味を推定しました。内容を確認・修正して保存してください。')
    })
  }

  function handleSaveMappings() {
    if (!spreadsheetConnectionId || !selectedSheet) {
      return
    }
    run('save', async () => {
      await apiPost('/api/spreadsheets/mappings', {
        spreadsheetConnectionId,
        sheetId: selectedSheet.sheetId,
        sheetName: selectedSheet.sheetName,
        headerRow,
        header: header.length > 0 ? header : columns.map((column) => column.columnName),
        columns,
      })
      // 保存が完了したらダッシュボードへ戻ります
      window.location.href = '/'
    })
  }

  function updateColumn(columnIndex: number, patch: Partial<ColumnDraft>) {
    setColumns((prev) =>
      prev.map((column) =>
        column.columnIndex === columnIndex ? { ...column, ...patch } : column,
      ),
    )
  }

  return (
    <div className="space-y-4">
      {status ? <Banner tone="success">{status}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      {/* 1. Google 連携 */}
      <Card>
        <SectionTitle>1. Google アカウント連携</SectionTitle>
        {googleEmail ? (
          <p className="mb-3 text-sm text-[#172b4d]">連携中: {googleEmail}</p>
        ) : (
          <p className="mb-3 text-sm text-[#5e6c84]">まだ連携されていません</p>
        )}
        <a href="/api/google/auth">
          <Button variant={googleEmail ? 'secondary' : 'primary'}>
            {googleEmail ? 'Google アカウントを連携し直す' : 'Google アカウントを連携する'}
          </Button>
        </a>
      </Card>

      {/* 2. Spreadsheet 登録 */}
      <Card>
        <SectionTitle>2. スプレッドシートの登録</SectionTitle>
        <Label>スプレッドシート URL</Label>
        <TextInput
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
        />
        <div className="mt-3 flex gap-2">
          <Button onClick={handleConnectSpreadsheet} disabled={loading !== null || url === ''}>
            {loading === 'connect' ? '登録中...' : '登録してシート一覧を取得'}
          </Button>
          {spreadsheetConnectionId ? (
            <Button variant="secondary" onClick={handleLoadSheets} disabled={loading !== null}>
              シート一覧を再取得
            </Button>
          ) : null}
        </div>
      </Card>

      {/* 3. シート選択 + ヘッダー行 */}
      {spreadsheetConnectionId ? (
        <Card>
          <SectionTitle>3. 使用するシートとヘッダー行</SectionTitle>
          <div className="space-y-3">
            <div>
              <Label>シート</Label>
              <Select
                value={selectedSheet?.sheetId ?? ''}
                onChange={(e) => {
                  const found = sheetOptions.find(
                    (option) => String(option.sheetId) === e.target.value,
                  )
                  setSelectedSheet(found ?? null)
                }}
              >
                <option value="">選択してください</option>
                {sheetOptions.length === 0 && selectedSheet ? (
                  <option value={selectedSheet.sheetId}>{selectedSheet.sheetName}（保存済み）</option>
                ) : null}
                {sheetOptions.map((option) => (
                  <option key={option.sheetId} value={option.sheetId}>
                    {option.sheetName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>ヘッダー行（1 行目とは限りません）</Label>
              <TextInput
                type="number"
                min={1}
                value={headerRow}
                onChange={(e) => setHeaderRow(Number(e.target.value) || 1)}
              />
            </div>
            <Button
              onClick={handleAnalyzeHeader}
              disabled={loading !== null || !selectedSheet}
            >
              {loading === 'header' ? 'AI が解析中...' : 'ヘッダーを解析して列を推定'}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* 4. 列マッピング確認 */}
      {columns.length > 0 ? (
        <Card>
          <SectionTitle>4. 列マッピングの確認</SectionTitle>
          <p className="mb-3 text-sm text-[#5e6c84]">
            AI の推定結果です。内容を確認し、必要に応じて修正してから保存してください。
          </p>

          {samples.length > 0 ? (
            <div className="mb-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {header.map((name, index) => (
                      <th
                        key={index}
                        className="whitespace-nowrap border border-[#dfe1e6] bg-[#f4f5f7] px-2 py-1 text-left"
                      >
                        {name || '(空)'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {samples.slice(0, 3).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {header.map((_, index) => (
                        <td
                          key={index}
                          className="whitespace-nowrap border border-[#dfe1e6] px-2 py-1 text-[#5e6c84]"
                        >
                          {row[index] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="space-y-3">
            {columns.map((column) => (
              <div key={column.columnIndex} className="rounded-[3px] border border-[#dfe1e6] p-3">
                <p className="mb-2 text-sm font-semibold text-[#172b4d]">
                  {column.columnLetter} 列 : {column.columnName || '(空)'}
                </p>

                <Label>意味（semantic type）</Label>
                <Select
                  value={column.semanticType}
                  onChange={(e) =>
                    updateColumn(column.columnIndex, { semanticType: e.target.value })
                  }
                >
                  {SEMANTIC_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}（{type.value}）
                    </option>
                  ))}
                </Select>

                {column.reason ? (
                  <p className="mt-1 text-xs text-[#5e6c84]">
                    AI の判断: {column.reason}
                    {column.confidence > 0 ? `（確信度 ${Math.round(column.confidence * 100)}%）` : ''}
                  </p>
                ) : null}

                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-[#42526e]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={column.useForMatching}
                      onChange={(e) =>
                        updateColumn(column.columnIndex, { useForMatching: e.target.checked })
                      }
                    />
                    案件特定に使用
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={column.aiEditable}
                      onChange={(e) =>
                        updateColumn(column.columnIndex, { aiEditable: e.target.checked })
                      }
                    />
                    AI 更新可能
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={column.readOnly}
                      onChange={(e) =>
                        updateColumn(column.columnIndex, { readOnly: e.target.checked })
                      }
                    />
                    読み取り専用
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={column.isFormula}
                      onChange={(e) =>
                        updateColumn(column.columnIndex, { isFormula: e.target.checked })
                      }
                    />
                    数式列
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Button onClick={handleSaveMappings} disabled={loading !== null} fullWidth>
              {loading === 'save' ? '保存中...' : '列マッピングを保存する'}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
