'use client'

import { useState } from 'react'
import { apiPost, toMessage } from '@/lib/api/fetcher'
import { Banner, Button, Card, Label, TextInput } from '@/components/ui'

/**
 * 初回ログイン時の組織作成フォーム。
 * organization に所属していないユーザーは何も操作できないため、ここで作成します。
 */
export function OrganizationSetup() {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await apiPost('/api/organizations/bootstrap', { name })
      window.location.reload()
    } catch (err) {
      setError(toMessage(err))
      setLoading(false)
    }
  }

  return (
    <Card>
      <p className="mb-4 text-sm text-[#5e6c84]">
        まだ組織が作成されていません。会社名・事務所名などを入力してください。
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>組織名</Label>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例) 太陽司法書士事務所"
            required
          />
        </div>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? '作成中...' : '組織を作成する'}
        </Button>
      </form>
    </Card>
  )
}
