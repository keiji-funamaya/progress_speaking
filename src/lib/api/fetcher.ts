/**
 * クライアントから API を呼ぶ共通関数。
 * レスポンス形式（{ ok, data, error }）の解釈をここへ統一します。
 */

export interface ApiFailure {
  ok: false
  error: string
  detail?: unknown
}

export class ApiError extends Error {
  detail?: unknown
  constructor(message: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.detail = detail
  }
}

async function parse<T>(response: Response): Promise<T> {
  const json = (await response.json()) as { ok: true; data: T } | ApiFailure
  if (!json.ok) {
    throw new ApiError(json.error, json.detail)
  }
  return json.data
}

export async function apiGet<T>(url: string): Promise<T> {
  return parse<T>(await fetch(url, { method: 'GET', cache: 'no-store' }))
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return parse<T>(
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

export async function apiPostForm<T>(url: string, formData: FormData): Promise<T> {
  return parse<T>(await fetch(url, { method: 'POST', body: formData }))
}

/** エラーからユーザー向けメッセージを取り出します */
export function toMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message
  }
  return '予期しないエラーが発生しました'
}
