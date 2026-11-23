import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/** ログアウト（ヘッダーのログアウトボタンから POST） */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()

  // POST 後に GET で /login を開かせるため 303 を指定します
  return NextResponse.redirect(new URL('/login', request.nextUrl.origin), 303)
}
