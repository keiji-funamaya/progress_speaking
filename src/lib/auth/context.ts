import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server'
import type { MemberRole, Organization } from '@/lib/types'

/**
 * ログインユーザーと所属 organization を解決するモジュール。
 *
 * 本システムでは DB 側の RLS を使用しないため、
 * テナント分離はすべてこのモジュールを起点にアプリ層で担保します。
 *
 * ルール:
 *   1. 全 API / Server Component は requireAuthContext() を通す
 *   2. 取得系クエリには必ず organization_id 条件を付与する
 *   3. 登録系は必ず context.organizationId を強制セットする
 */

export interface AuthContext {
  userId: string
  email: string | null
  organizationId: string
  organizationName: string
  role: MemberRole
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/**
 * ログインユーザーとその所属 organization を取得します。
 * 未ログイン、または organization 未所属の場合は AuthError を投げます。
 */
export async function requireAuthContext(): Promise<AuthContext> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new AuthError('ログインが必要です', 401)
  }

  const admin = createAdminSupabase()
  const { data: member, error } = await admin
    .from('organization_members')
    .select('organization_id, role, organizations(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new AuthError(`所属組織の取得に失敗しました: ${error.message}`, 500)
  }
  if (!member) {
    throw new AuthError('組織に所属していません。管理者に招待を依頼してください。', 403)
  }

  const organization = member.organizations as unknown as Organization | null

  return {
    userId: user.id,
    email: user.email ?? null,
    organizationId: member.organization_id,
    organizationName: organization?.name ?? '(名称未設定)',
    role: member.role as MemberRole,
  }
}

/**
 * ログインしていない場合は null を返します（画面側のリダイレクト判定用）。
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    return await requireAuthContext()
  } catch {
    return null
  }
}
