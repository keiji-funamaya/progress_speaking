import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AuthError } from '@/lib/auth/context'

/**
 * Route Handler で共通して使うレスポンス生成。
 * 記法を統一するため、API のエラー処理は必ずここを経由します。
 */

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

export function jsonError(message: string, status = 400, detail?: unknown) {
  return NextResponse.json({ ok: false, error: message, detail }, { status })
}

/** 例外を API レスポンスへ変換します */
export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return jsonError(error.message, error.status)
  }
  if (error instanceof ZodError) {
    return jsonError('入力値が不正です', 422, error.flatten())
  }
  if (error instanceof Error) {
    console.error('[api]', error)
    return jsonError(error.message, 500)
  }
  console.error('[api] unknown error', error)
  return jsonError('予期しないエラーが発生しました', 500)
}
