'use client'

import { createBrowserClient } from '@supabase/ssr'
import { APP_DB_SCHEMA } from '@/lib/constants'

/**
 * ブラウザ用 Supabase クライアント。
 * anon key のみを使用します。Service Role Key は絶対に使用しません。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: APP_DB_SCHEMA } },
  )
}
