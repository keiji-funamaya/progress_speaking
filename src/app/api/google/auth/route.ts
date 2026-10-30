import { NextResponse } from 'next/server'
import { requireAuthContext } from '@/lib/auth/context'
import { buildAuthUrl } from '@/lib/google/oauth'
import { handleApiError } from '@/lib/api/response'

/** Google OAuth 同意画面へリダイレクトします */
export async function GET() {
  try {
    const auth = await requireAuthContext()
    // state に organization / user を含め、callback 側で検証します
    const state = Buffer.from(
      JSON.stringify({ organizationId: auth.organizationId, userId: auth.userId }),
    ).toString('base64url')

    return NextResponse.redirect(buildAuthUrl(state))
  } catch (error) {
    return handleApiError(error)
  }
}
