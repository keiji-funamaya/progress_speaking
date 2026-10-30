import { NextResponse, type NextRequest } from 'next/server'
import { google } from 'googleapis'
import { requireAuthContext } from '@/lib/auth/context'
import { createOAuthClient, exchangeCode } from '@/lib/google/oauth'
import { createAdminSupabase } from '@/lib/supabase/server'
import { GOOGLE_OAUTH_SCOPES } from '@/lib/constants'
import { handleApiError } from '@/lib/api/response'

/**
 * Google OAuth コールバック。
 * refresh token はサーバー側で DB へ保存し、クライアントへは返しません。
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext()
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')

    const settingsUrl = new URL('/settings', request.nextUrl.origin)

    if (oauthError) {
      settingsUrl.searchParams.set('error', `Google連携がキャンセルされました: ${oauthError}`)
      return NextResponse.redirect(settingsUrl)
    }
    if (!code || !state) {
      settingsUrl.searchParams.set('error', '認可コードを取得できませんでした')
      return NextResponse.redirect(settingsUrl)
    }

    // state 検証（別 organization への差し替えを防ぎます）
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
      organizationId?: string
      userId?: string
    }
    if (decoded.organizationId !== auth.organizationId || decoded.userId !== auth.userId) {
      settingsUrl.searchParams.set('error', '認可リクエストの検証に失敗しました')
      return NextResponse.redirect(settingsUrl)
    }

    const tokens = await exchangeCode(code)

    // 連携した Google アカウントのメールアドレスを取得します
    const client = createOAuthClient()
    client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const profile = await oauth2.userinfo.get()
    const email = profile.data.email ?? 'unknown'

    const admin = createAdminSupabase()
    const { data: existing } = await admin
      .from('google_connections')
      .select('id, refresh_token')
      .eq('organization_id', auth.organizationId)
      .eq('google_account_email', email)
      .maybeSingle()

    const payload = {
      organization_id: auth.organizationId,
      user_id: auth.userId,
      google_account_email: email,
      // 再連携時に refresh_token が返らないことがあるため既存値を維持します
      refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
      access_token: tokens.access_token ?? null,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scopes: tokens.scope ? tokens.scope.split(' ') : GOOGLE_OAUTH_SCOPES,
    }

    if (existing) {
      await admin
        .from('google_connections')
        .update(payload)
        .eq('id', existing.id)
        .eq('organization_id', auth.organizationId)
    } else {
      await admin.from('google_connections').insert(payload)
    }

    settingsUrl.searchParams.set('message', `Google アカウント (${email}) を連携しました`)
    return NextResponse.redirect(settingsUrl)
  } catch (error) {
    return handleApiError(error)
  }
}
