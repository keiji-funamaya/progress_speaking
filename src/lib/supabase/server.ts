import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { APP_DB_SCHEMA } from '@/lib/constants'

/**
 * サーバー用 Supabase クライアント（ログインユーザーのセッションで動作）。
 * Server Component / Route Handler から使用します。
 */
export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: APP_DB_SCHEMA },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component から呼ばれた場合は書き込めないため無視します。
          }
        },
      },
    },
  )
}

/**
 * Service Role Key を使うサーバー専用クライアント。
 * refresh token など秘密情報を扱う処理でのみ使用します。
 * ブラウザへは絶対に露出させません。
 */
export function createAdminSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません')
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    db: { schema: APP_DB_SCHEMA },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
