import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthContext } from '@/lib/auth/context'
import { applyUpdates } from '@/lib/updates/apply'
import { handleApiError, jsonOk } from '@/lib/api/response'

/**
 * 確認画面の「反映」ボタンからのみ呼ばれる書き込み API。
 * 反映直前の再取得・競合確認・履歴保存・反映後検証は applyUpdates 内で行います。
 */
export const maxDuration = 120

const bodySchema = z.object({
  sheetConfigId: z.string().uuid().optional(),
  projects: z
    .array(
      z.object({
        identifier: z.object({
          primaryKeyColumnIndex: z.number().int().optional(),
          primaryKeyColumnName: z.string().optional(),
          primaryKeyValue: z.string().optional(),
          fields: z.array(
            z.object({
              columnIndex: z.number().int().min(0),
              columnName: z.string(),
              value: z.string(),
            }),
          ),
          observedRowNumber: z.number().int().optional(),
        }),
        cells: z
          .array(
            z.object({
              columnIndex: z.number().int().min(0),
              newValue: z.string(),
              observedOldValue: z.string(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext()
    const body = bodySchema.parse(await request.json())

    const result = await applyUpdates(auth, body.sheetConfigId, body.projects)
    return jsonOk(result)
  } catch (error) {
    return handleApiError(error)
  }
}
