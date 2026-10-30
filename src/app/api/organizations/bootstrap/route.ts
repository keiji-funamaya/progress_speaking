import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server'
import { handleApiError, jsonError, jsonOk } from '@/lib/api/response'

/**
 * 初回ログイン時に organization を作成し、ログインユーザーを owner として所属させます。
 * 既に所属している場合は何もしません。
 */
const bodySchema = z.object({
  name: z.string().min(1).max(100),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonError('ログインが必要です', 401)
    }

    const admin = createAdminSupabase()
    const { data: existing } = await admin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return jsonOk({ organizationId: existing.organization_id, created: false })
    }

    const { name } = bodySchema.parse(await request.json())

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert({ name })
      .select('id')
      .single()

    if (organizationError || !organization) {
      return jsonError(`組織の作成に失敗しました: ${organizationError?.message}`, 500)
    }

    const { error: memberError } = await admin.from('organization_members').insert({
      organization_id: organization.id,
      user_id: user.id,
      role: 'owner',
    })

    if (memberError) {
      return jsonError(`組織への所属登録に失敗しました: ${memberError.message}`, 500)
    }

    return jsonOk({ organizationId: organization.id, created: true })
  } catch (error) {
    return handleApiError(error)
  }
}
