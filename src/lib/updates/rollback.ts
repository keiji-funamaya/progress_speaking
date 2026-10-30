import { createAdminSupabase } from '@/lib/supabase/server'
import { fetchCellValue, updateCell } from '@/lib/sheets/client'
import { loadDataRows, loadSheetContext, type SheetContext } from '@/lib/sheets/context'
import { findRowByIdentifier } from '@/lib/sheets/projects'
import type { AuthContext } from '@/lib/auth/context'
import type { BatchStatus, RollbackCellResult, SheetUpdateLog } from '@/lib/types'

/**
 * ロールバック処理。
 *
 * 流れ:
 *   1. 履歴（sheet_update_logs）を取得
 *   2. 案件を識別情報から再検索（行番号は信用しない）
 *   3. Google Sheets の現在値を取得
 *   4. 現在値 == new_value のときだけ old_value を書き戻す
 *      （異なる場合は反映後に第三者が変更した可能性 → 停止して競合表示）
 *   5. 書き戻し後に再取得して検証
 *   6. status を確定（履歴は削除しない）
 */

export interface RollbackResult {
  results: RollbackCellResult[]
  revertedCount: number
  conflictCount: number
  failedCount: number
  /** 競合があり 1 件も実行しなかった場合 true */
  aborted: boolean
  message: string
}

/** 競合表示用のメッセージ */
function conflictMessage(afterApply: string, current: string): string {
  return [
    'このセルは反映後に変更されています。',
    `変更直後: ${afterApply || '(空)'}`,
    `現在: ${current || '(空)'}`,
    '元に戻すと現在の変更が失われる可能性があります。',
  ].join('\n')
}

/** 対象ログの現在値を取得します（案件再検索込み） */
async function resolveCurrentValues(
  context: SheetContext,
  logs: SheetUpdateLog[],
): Promise<Map<string, { rowNumber: number | null; currentValue: string | null; error: string | null }>> {
  const rows = await loadDataRows(context)
  const spreadsheetId = context.spreadsheetConnection.spreadsheet_id
  const sheetName = context.sheetConfig.sheet_name
  const resolved = new Map<
    string,
    { rowNumber: number | null; currentValue: string | null; error: string | null }
  >()

  for (const log of logs) {
    const { rowNumber, candidates } = findRowByIdentifier(log.project_identifier, rows)

    if (rowNumber === null) {
      resolved.set(log.id, {
        rowNumber: null,
        currentValue: null,
        error:
          candidates.length > 1
            ? '対象案件が複数見つかりました。手動で確認してください。'
            : '対象案件がスプレッドシート上で見つかりませんでした。',
      })
      continue
    }

    try {
      const currentValue = await fetchCellValue(
        context.sheetsApi,
        spreadsheetId,
        sheetName,
        rowNumber,
        log.column_index,
      )
      resolved.set(log.id, { rowNumber, currentValue, error: null })
    } catch (error) {
      resolved.set(log.id, {
        rowNumber,
        currentValue: null,
        error: error instanceof Error ? error.message : '現在値の取得に失敗しました',
      })
    }
  }

  return resolved
}

/** 1 件の書き戻しと検証を行います */
async function revertOne(
  context: SheetContext,
  auth: AuthContext,
  log: SheetUpdateLog,
  rowNumber: number,
): Promise<RollbackCellResult> {
  const admin = createAdminSupabase()
  const spreadsheetId = context.spreadsheetConnection.spreadsheet_id
  const sheetName = context.sheetConfig.sheet_name
  const restoreValue = log.old_value ?? ''

  try {
    await updateCell(
      context.sheetsApi,
      spreadsheetId,
      sheetName,
      rowNumber,
      log.column_index,
      restoreValue,
    )

    const written = await fetchCellValue(
      context.sheetsApi,
      spreadsheetId,
      sheetName,
      rowNumber,
      log.column_index,
    )

    if (written === restoreValue) {
      await admin
        .from('sheet_update_logs')
        .update({
          status: 'reverted',
          reverted_at: new Date().toISOString(),
          reverted_by: auth.userId,
          error_message: null,
        })
        .eq('id', log.id)
        .eq('organization_id', auth.organizationId)

      return {
        logId: log.id,
        status: 'reverted',
        message: null,
        currentValue: written,
        expectedValue: restoreValue,
        restoredValue: written,
      }
    }

    const message = `ロールバック後の検証に失敗しました（期待値: ${restoreValue} / 実際値: ${written}）`
    await admin
      .from('sheet_update_logs')
      .update({ status: 'rollback_failed', error_message: message })
      .eq('id', log.id)
      .eq('organization_id', auth.organizationId)

    return {
      logId: log.id,
      status: 'rollback_failed',
      message,
      currentValue: written,
      expectedValue: restoreValue,
      restoredValue: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ロールバックに失敗しました'
    await admin
      .from('sheet_update_logs')
      .update({ status: 'rollback_failed', error_message: message })
      .eq('id', log.id)
      .eq('organization_id', auth.organizationId)

    return {
      logId: log.id,
      status: 'rollback_failed',
      message,
      currentValue: null,
      expectedValue: restoreValue,
      restoredValue: null,
    }
  }
}

/** organization を条件に含めて履歴を取得します */
async function loadLogs(
  organizationId: string,
  filter: { batchId?: string; logId?: string },
): Promise<SheetUpdateLog[]> {
  const admin = createAdminSupabase()
  let query = admin
    .from('sheet_update_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'applied')

  if (filter.batchId) {
    query = query.eq('update_batch_id', filter.batchId)
  }
  if (filter.logId) {
    query = query.eq('id', filter.logId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`更新履歴の取得に失敗しました: ${error.message}`)
  }
  return (data ?? []) as SheetUpdateLog[]
}

/** 対象 batch が使用した sheet_config を特定します */
async function findSheetConfigId(
  organizationId: string,
  batchId: string,
): Promise<string | undefined> {
  const admin = createAdminSupabase()
  const { data } = await admin
    .from('update_batches')
    .select('sheet_config_id')
    .eq('id', batchId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  return data?.sheet_config_id ?? undefined
}

/** batch の status を再計算します */
async function refreshBatchStatus(organizationId: string, batchId: string): Promise<void> {
  const admin = createAdminSupabase()
  const { data: logs } = await admin
    .from('sheet_update_logs')
    .select('status')
    .eq('organization_id', organizationId)
    .eq('update_batch_id', batchId)

  const statuses = (logs ?? []).map((log) => log.status as string)
  const reverted = statuses.filter((status) => status === 'reverted').length
  const applied = statuses.filter((status) => status === 'applied').length

  let batchStatus: BatchStatus
  if (reverted > 0 && applied === 0) {
    batchStatus = 'reverted'
  } else if (reverted > 0) {
    batchStatus = 'partially_reverted'
  } else {
    return
  }

  await admin
    .from('update_batches')
    .update({
      status: batchStatus,
      reverted_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .eq('organization_id', organizationId)
}

/**
 * ロールバックを実行します。
 *
 * @param requireAllClean true の場合、1 件でも競合があれば全件実行しません（一括ロールバック用）
 */
export async function rollback(
  auth: AuthContext,
  filter: { batchId?: string; logId?: string },
  requireAllClean: boolean,
): Promise<RollbackResult> {
  const logs = await loadLogs(auth.organizationId, filter)
  if (logs.length === 0) {
    return {
      results: [],
      revertedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      aborted: false,
      message: '元に戻せる更新がありません（既にロールバック済みの可能性があります）',
    }
  }

  const sheetConfigId = await findSheetConfigId(auth.organizationId, logs[0].update_batch_id)
  const context = await loadSheetContext(auth.organizationId, sheetConfigId)
  const resolved = await resolveCurrentValues(context, logs)

  // 競合判定（現在値 != new_value なら反映後に第三者が変更している）
  const conflicts = logs.filter((log) => {
    const info = resolved.get(log.id)
    if (!info || info.rowNumber === null || info.currentValue === null) {
      return true
    }
    return info.currentValue !== (log.new_value ?? '')
  })

  if (requireAllClean && conflicts.length > 0) {
    const admin = createAdminSupabase()
    const results: RollbackCellResult[] = logs.map((log) => {
      const info = resolved.get(log.id)
      const isConflict = conflicts.some((conflict) => conflict.id === log.id)
      return {
        logId: log.id,
        status: isConflict ? 'conflict' : 'applied',
        message: isConflict
          ? (info?.error ?? conflictMessage(log.new_value ?? '', info?.currentValue ?? ''))
          : null,
        currentValue: info?.currentValue ?? null,
        expectedValue: log.new_value,
        restoredValue: null,
      }
    })

    // 競合セルは履歴側にも記録します（強制上書きは行いません）
    for (const conflict of conflicts) {
      const info = resolved.get(conflict.id)
      await admin
        .from('sheet_update_logs')
        .update({
          error_message:
            info?.error ?? conflictMessage(conflict.new_value ?? '', info?.currentValue ?? ''),
        })
        .eq('id', conflict.id)
        .eq('organization_id', auth.organizationId)
    }

    return {
      results,
      revertedCount: 0,
      conflictCount: conflicts.length,
      failedCount: 0,
      aborted: true,
      message: `${logs.length}件中${conflicts.length}件が反映後に変更されています`,
    }
  }

  const results: RollbackCellResult[] = []

  for (const log of logs) {
    const info = resolved.get(log.id)
    const isConflict = conflicts.some((conflict) => conflict.id === log.id)

    if (isConflict || !info || info.rowNumber === null) {
      results.push({
        logId: log.id,
        status: 'conflict',
        message: info?.error ?? conflictMessage(log.new_value ?? '', info?.currentValue ?? ''),
        currentValue: info?.currentValue ?? null,
        expectedValue: log.new_value,
        restoredValue: null,
      })
      continue
    }

    results.push(await revertOne(context, auth, log, info.rowNumber))
  }

  const batchIds = Array.from(new Set(logs.map((log) => log.update_batch_id)))
  for (const batchId of batchIds) {
    await refreshBatchStatus(auth.organizationId, batchId)
  }

  const revertedCount = results.filter((result) => result.status === 'reverted').length
  const conflictCount = results.filter((result) => result.status === 'conflict').length
  const failedCount = results.filter((result) => result.status === 'rollback_failed').length

  return {
    results,
    revertedCount,
    conflictCount,
    failedCount,
    aborted: false,
    message:
      conflictCount > 0 || failedCount > 0
        ? `${revertedCount}件を元に戻しました（競合 ${conflictCount}件 / 失敗 ${failedCount}件）`
        : `${revertedCount}件を元に戻しました`,
  }
}
