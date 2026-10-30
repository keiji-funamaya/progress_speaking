import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * 全画面共通のレイアウト。
 * スマホ最優先のため、中央 1 カラム + 上部ヘッダー構成にしています。
 */
export function AppShell({
  title,
  organizationName,
  backHref,
  children,
}: {
  title: string
  organizationName?: string
  backHref?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[#dfe1e6] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {backHref ? (
            <Link href={backHref} className="text-sm text-[#0052cc] hover:underline">
              ← 戻る
            </Link>
          ) : null}
          <h1 className="flex-1 truncate text-base font-semibold text-[#172b4d]">{title}</h1>
          {organizationName ? (
            <span className="truncate text-xs text-[#5e6c84]">{organizationName}</span>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4 pb-24">{children}</main>
    </div>
  )
}
