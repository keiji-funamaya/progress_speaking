'use client'

import { useState } from 'react'
import { apiPost, toMessage } from '@/lib/api/fetcher'
import { Badge, Banner, Button, Card, Label, SectionTitle } from '@/components/ui'
import {
  BATCH_STATUS_LABEL,
  batchStatusTone,
  displayValue,
  formatDateTime,
  LOG_STATUS_LABEL,
  logStatusTone,
} from '@/lib/format'
import { describeIdentifier } from '@/lib/sheets/projects'
import type { RollbackCellResult, SheetUpdateLog, UpdateBatch } from '@/lib/types'

/**
 * 更新履歴詳細 + ロールバック確認画面。
 *
 * ロールバックは無条件に old_value を書き戻さず、
 * サーバー側で現在値 == new_value を確認します。
 * 競合時は停止し、その内容を表示します。
 */
export function HistoryDetailClient({
  batch,
  logs,
}: {
  batch: UpdateBatch
  logs: SheetUpdateLog[]
}) {
  const [results, setResults] = useState<Map<string, RollbackCellResult>>(new Map())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  function run(key: string, task: () => Promise<void>) {
    setLoading(key)
    setError(null)
    setMessage(null)
    task()
      .catch((err) => setError(toMessage(err)))
      .finally(() => setLoading(null))
  }

  function applyResults(next: RollbackCellResult[]) {
    setResults((prev) => {
      const merged = new Map(prev)
      next.forEach((result) => merged.set(result.logId, result))
      return merged
    })
  }

  function handleRollbackBatch() {
    run('batch', async () => {
      const data = await apiPost<{
        results: RollbackCellResult[]
        message: string
        aborted: boolean
      }>(`/api/updates/${batch.id}/rollback`)
      applyResults(data.results)
      if (data.aborted) {
        setError(data.message)
      } else {
        setMessage(data.message)
      }
    })
  }

  function handleRollbackLog(logId: string) {
    run(logId, async () => {
      const data = await apiPost<{ results: RollbackCellResult[]; message: string }>(
        `/api/updates/logs/${logId}/rollback`,
      )
      applyResults(data.results)
      setMessage(data.message)
    })
  }

  const revertableCount = logs.filter((log) => log.status === 'applied').length

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[#172b4d]">
            {formatDateTime(batch.created_at)}
          </span>
          <Badge tone={batchStatusTone(batch.status)}>{BATCH_STATUS_LABEL[batch.status]}</Badge>
        </div>
        <p className="text-sm text-[#5e6c84]">
          {batch.source_type === 'voice' ? '音声進捗報告' : '手動更新'} ／ {logs.length}セル
        </p>
        {batch.reverted_at ? (
          <p className="mt-1 text-sm text-[#5e6c84]">
            ロールバック日時: {formatDateTime(batch.reverted_at)}
          </p>
        ) : null}
      </Card>

      {message ? <Banner tone="success">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      {revertableCount > 0 ? (
        <Card>
          <SectionTitle>この更新をすべて元に戻す</SectionTitle>
          <p className="mb-3 text-sm text-[#5e6c84]">
            反映後に他の人が変更したセルが 1 件でもある場合、安全のため 1 件も実行しません。
          </p>
          <Button variant="danger" onClick={handleRollbackBatch} disabled={loading !== null}>
            {loading === 'batch' ? '処理中...' : `今回の変更をすべて元に戻す（${revertableCount}件）`}
          </Button>
        </Card>
      ) : null}

      <div className="space-y-3">
        {logs.map((log) => {
          const result = results.get(log.id)
          const status = result?.status ?? log.status

          return (
            <Card key={log.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#172b4d]">
                  {describeIdentifier(log.project_identifier)}
                </span>
                <Badge tone={logStatusTone(status)}>{LOG_STATUS_LABEL[status]}</Badge>
              </div>

              <Label>
                {log.column_name ?? log.column_letter}（{log.column_letter}
                {log.row_number}）
              </Label>
              <p className="text-sm text-[#42526e]">
                {displayValue(log.old_value)} → {displayValue(log.new_value)}
              </p>

              {result?.message ? (
                <div className="mt-2">
                  <Banner tone={status === 'conflict' ? 'warning' : 'error'}>
                    {result.message}
                  </Banner>
                </div>
              ) : log.error_message ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-[#bf2600]">
                  {log.error_message}
                </p>
              ) : null}

              {status === 'applied' ? (
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    onClick={() => handleRollbackLog(log.id)}
                    disabled={loading !== null}
                  >
                    {loading === log.id ? '処理中...' : 'このセルを元に戻す'}
                  </Button>
                </div>
              ) : null}

              {log.reverted_at ? (
                <p className="mt-2 text-xs text-[#5e6c84]">
                  ロールバック日時: {formatDateTime(log.reverted_at)}
                </p>
              ) : null}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
