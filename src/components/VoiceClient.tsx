'use client'

import Link from 'next/link'
import { useState } from 'react'
import { VoiceRecorder } from '@/components/VoiceRecorder'
import { ReviewBlockCard } from '@/components/ReviewBlockCard'
import { Badge, Banner, Button, Card, Label, SectionTitle } from '@/components/ui'
import { apiPost, apiPostForm, toMessage } from '@/lib/api/fetcher'
import { displayValue, LOG_STATUS_LABEL, logStatusTone } from '@/lib/format'
import { writableMappings } from '@/lib/validation/writable'
import type {
  AnalyzedBlock,
  ApplyCellResult,
  ApplyProjectPayload,
  ColumnMapping,
  ProjectRow,
} from '@/lib/types'

/**
 * 音声入力から反映までの一連の流れを管理する画面。
 *
 *   録音 → 文字起こし → 修正 → AI 解析 → 確認 → 手動修正 → 反映 → 完了
 *
 * AI 解析の途中データは DB へ保存せず、この画面の state でのみ保持します。
 */

type Step = 'record' | 'transcript' | 'review' | 'done'

interface AnalyzeResponse {
  sheetConfigId: string
  sheetName: string
  mappings: ColumnMapping[]
  projects: ProjectRow[]
  blocks: AnalyzedBlock[]
}

interface ApplyResponse {
  batchId: string
  results: ApplyCellResult[]
  appliedCount: number
  failedCount: number
  conflictCount: number
}

export function VoiceClient() {
  const [step, setStep] = useState<Step>('record')
  const [transcript, setTranscript] = useState('')
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null)
  const [blocks, setBlocks] = useState<AnalyzedBlock[]>([])
  const [applyResult, setApplyResult] = useState<ApplyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const editable = analysis ? writableMappings(analysis.mappings) : []

  function run(key: string, task: () => Promise<void>) {
    setLoading(key)
    setError(null)
    task()
      .catch((err) => setError(toMessage(err)))
      .finally(() => setLoading(null))
  }

  function handleRecorded(blob: Blob) {
    run('transcribe', async () => {
      const formData = new FormData()
      // 拡張子は文字起こし API 側のフォーマット判定に使われます
      formData.append('audio', blob, 'recording.webm')
      const data = await apiPostForm<{ transcript: string }>('/api/voice/transcribe', formData)
      setTranscript(data.transcript)
      setStep('transcript')
    })
  }

  function handleAnalyze() {
    run('analyze', async () => {
      const data = await apiPost<AnalyzeResponse>('/api/voice/analyze', { transcript })
      setAnalysis(data)
      setBlocks(data.blocks)
      setStep('review')
    })
  }

  function handleApply() {
    if (!analysis) {
      return
    }

    // 反映対象を組み立てます。無効な案件・無効な候補・値が空の候補は除外します。
    const projects: ApplyProjectPayload[] = blocks
      .filter((block) => block.enabled && block.identifier !== null)
      .map((block) => ({
        identifier: block.identifier!,
        cells: block.candidates
          .filter((candidate) => candidate.enabled)
          .map((candidate) => ({
            columnIndex: candidate.columnIndex,
            newValue: candidate.newValue,
            observedOldValue: candidate.currentValue,
          })),
      }))
      .filter((project) => project.cells.length > 0)

    if (projects.length === 0) {
      setError('反映対象がありません。案件と更新項目を選択してください。')
      return
    }

    run('apply', async () => {
      const data = await apiPost<ApplyResponse>('/api/updates/apply', {
        sheetConfigId: analysis.sheetConfigId,
        projects,
      })
      setApplyResult(data)
      setStep('done')
    })
  }

  function handleRollbackAll() {
    if (!applyResult) {
      return
    }
    // 競合の有無にかかわらず、結果は履歴詳細画面で確認できるようにします
    run('rollback', async () => {
      await apiPost(`/api/updates/${applyResult.batchId}/rollback`)
      window.location.href = `/history/${applyResult.batchId}`
    })
  }

  return (
    <div className="space-y-4">
      {error ? <Banner tone="error">{error}</Banner> : null}

      {/* 1. 録音 */}
      {step === 'record' ? (
        <Card>
          <SectionTitle>進捗を話してください</SectionTitle>
          <p className="mb-4 text-sm text-[#5e6c84]">
            複数の案件をまとめて話せます。停止すると自動で文字起こしされます。
          </p>
          <VoiceRecorder onRecorded={handleRecorded} disabled={loading !== null} />
          {loading === 'transcribe' ? (
            <p className="mt-3 text-center text-sm text-[#5e6c84]">文字起こし中...</p>
          ) : null}
        </Card>
      ) : null}

      {/* 2. 文字起こし確認 */}
      {step === 'transcript' ? (
        <Card>
          <SectionTitle>文字起こしの確認</SectionTitle>
          <p className="mb-2 text-sm text-[#5e6c84]">
            誤変換があれば修正してから解析してください。
          </p>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={8}
            className="w-full rounded-[3px] border border-[#dfe1e6] bg-[#fafbfc] px-3 py-2 text-[#172b4d] focus:border-[#0052cc] focus:bg-white focus:outline-none"
          />
          <div className="mt-3 flex gap-2">
            <Button onClick={handleAnalyze} disabled={loading !== null || transcript.trim() === ''}>
              {loading === 'analyze' ? 'AI が解析中...' : 'AI で解析する'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setStep('record')
                setTranscript('')
              }}
              disabled={loading !== null}
            >
              録音し直す
            </Button>
          </div>
        </Card>
      ) : null}

      {/* 3. 確認画面 */}
      {step === 'review' && analysis ? (
        <div className="space-y-4">
          <Banner tone="info">
            AI の解析結果です。内容を確認・修正し、下部のボタンでスプレッドシートへ反映してください。
          </Banner>

          {blocks.map((block) => (
            <ReviewBlockCard
              key={block.id}
              block={block}
              projects={analysis.projects}
              editableMappings={editable}
              onChange={(next) =>
                setBlocks((prev) => prev.map((item) => (item.id === next.id ? next : item)))
              }
            />
          ))}

          <div className="sticky bottom-0 -mx-4 border-t border-[#dfe1e6] bg-white px-4 py-3">
            <Button onClick={handleApply} disabled={loading !== null} fullWidth>
              {loading === 'apply' ? '反映中...' : '選択した内容をスプレッドシートへ反映'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* 4. 完了 */}
      {step === 'done' && applyResult ? (
        <div className="space-y-4">
          <Card>
            <SectionTitle>{applyResult.appliedCount}件の更新が完了しました</SectionTitle>
            {applyResult.failedCount > 0 || applyResult.conflictCount > 0 ? (
              <Banner tone="warning">
                {`失敗 ${applyResult.failedCount}件 / 競合 ${applyResult.conflictCount}件があります。内容を確認してください。`}
              </Banner>
            ) : null}
          </Card>

          <Card>
            <SectionTitle>更新内容</SectionTitle>
            <ul className="divide-y divide-[#dfe1e6]">
              {applyResult.results.map((result, index) => (
                <li key={index} className="py-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#172b4d]">
                      {result.projectLabel}
                    </span>
                    <Badge tone={logStatusTone(result.status)}>
                      {LOG_STATUS_LABEL[result.status]}
                    </Badge>
                  </div>
                  <Label>{result.columnName ?? result.columnLetter}</Label>
                  <p className="text-sm text-[#42526e]">
                    {displayValue(result.oldValue)} → {displayValue(result.newValue)}
                  </p>
                  {result.message ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-[#bf2600]">
                      {result.message}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-col gap-2">
            <Button variant="danger" onClick={handleRollbackAll} disabled={loading !== null}>
              {loading === 'rollback' ? '処理中...' : '今回の変更を元に戻す'}
            </Button>
            <Link href="/">
              <Button variant="secondary" fullWidth>
                ダッシュボードへ戻る
              </Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
