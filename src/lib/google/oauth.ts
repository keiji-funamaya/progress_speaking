import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { createAdminSupabase } from '@/lib/supabase/server'
import { GOOGLE_OAUTH_SCOPES } from '@/lib/constants'
import type { GoogleConnection } from '@/lib/types'

/**
 * Google OAuth 2.0 のクライアント生成とトークン管理。
 * refresh token はサーバー側でのみ扱い、クライアントへは返しません。
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} が設定されていません`)
  }
  return value
}

/** 認可用の OAuth2 クライアント（トークン未設定） */
export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    requireEnv('GOOGLE_REDIRECT_URI'),
  )
}

/** 同意画面の URL を生成します */
export function buildAuthUrl(state: string): string {
  return createOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: GOOGLE_OAUTH_SCOPES,
    state,
  })
}

/** 認可コードをトークンへ交換します */
export async function exchangeCode(code: string) {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

/**
 * organization に紐づく Google 接続を取得します。
 * organization_id を必ず条件に含め、他組織のデータを参照しません。
 */
export async function findGoogleConnection(
  organizationId: string,
  googleConnectionId?: string,
): Promise<GoogleConnection | null> {
  const admin = createAdminSupabase()
  let query = admin
    .from('google_connections')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (googleConnectionId) {
    query = query.eq('id', googleConnectionId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(`Google 接続情報の取得に失敗しました: ${error.message}`)
  }
  return (data as GoogleConnection | null) ?? null
}

/**
 * 有効な access token を持つ OAuth2 クライアントを返します。
 * 期限切れの場合は refresh token で更新し、DB へ保存し直します。
 */
export async function createAuthorizedClient(
  connection: GoogleConnection,
): Promise<OAuth2Client> {
  const client = createOAuthClient()
  client.setCredentials({
    access_token: connection.access_token ?? undefined,
    refresh_token: connection.refresh_token ?? undefined,
    expiry_date: connection.token_expires_at
      ? new Date(connection.token_expires_at).getTime()
      : undefined,
  })

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0
  const needsRefresh = !connection.access_token || expiresAt - Date.now() < 60_000

  if (needsRefresh) {
    if (!connection.refresh_token) {
      throw new Error(
        'Google の再連携が必要です。設定画面から Google アカウントを連携し直してください。',
      )
    }
    const { credentials } = await client.refreshAccessToken()
    client.setCredentials(credentials)

    const admin = createAdminSupabase()
    await admin
      .from('google_connections')
      .update({
        access_token: credentials.access_token ?? null,
        token_expires_at: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
      })
      .eq('id', connection.id)
      .eq('organization_id', connection.organization_id)
  }

  return client
}

/**
 * organization から直接 認証済みクライアントを取得する簡易ヘルパー。
 */
export async function getAuthorizedClientForOrganization(
  organizationId: string,
  googleConnectionId?: string,
): Promise<OAuth2Client> {
  const connection = await findGoogleConnection(organizationId, googleConnectionId)
  if (!connection) {
    throw new Error('Google アカウントが連携されていません')
  }
  return createAuthorizedClient(connection)
}
