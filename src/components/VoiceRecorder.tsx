'use client'

import { useEffect, useRef, useState } from 'react'
import { Banner, Button } from '@/components/ui'

/**
 * 録音 UI。
 * スマホ最優先のため、大きな録音ボタンと録音時間を表示します。
 * 音声ファイルは保存せず、文字起こし後に破棄します。
 */

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function VoiceRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (blob: Blob) => void
  disabled?: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        onRecorded(blob)
      }

      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((prev) => prev + 1), 1000)
    } catch {
      setError('マイクを使用できません。ブラウザのマイク許可を確認してください。')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Banner tone="error">{error}</Banner> : null}

      {recording ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3 rounded-[3px] bg-[#ffebe6] py-6">
            <span className="h-3 w-3 animate-pulse rounded-full bg-[#de350b]" />
            <span className="text-sm font-semibold text-[#bf2600]">録音中</span>
            <span className="font-mono text-xl text-[#bf2600]">{formatSeconds(seconds)}</span>
          </div>
          <Button variant="danger" fullWidth onClick={stopRecording}>
            ■ 停止
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className="flex min-h-[140px] w-full items-center justify-center rounded-[3px] bg-[#0052cc] text-xl font-bold text-white shadow-[0_1px_2px_rgba(9,30,66,0.25)] hover:bg-[#0065ff] disabled:bg-[#a5adba]"
        >
          🎤 進捗を音声入力
        </button>
      )}
    </div>
  )
}
