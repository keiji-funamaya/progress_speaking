'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Banner, Button, Card, Label, TextInput } from '@/components/ui'

/**
 * ログイン画面。
 * Supabase Auth のメール + パスワードを使用します。
 */
export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const supabase = createClient()

    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
      window.location.href = '/'
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (signUpError) {
      setError(signUpError.message)
    } else {
      setMessage('確認メールを送信しました。メール内のリンクから登録を完了してください。')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-[#172b4d]">音声進捗更新</h1>
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>メールアドレス</Label>
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label>パスワード</Label>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>

            {error ? <Banner tone="error">{error}</Banner> : null}
            {message ? <Banner tone="success">{message}</Banner> : null}

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? '処理中...' : mode === 'signin' ? 'ログイン' : '新規登録'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-[#0052cc] hover:underline"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
                setMessage(null)
              }}
            >
              {mode === 'signin' ? '新規登録はこちら' : 'ログインはこちら'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
