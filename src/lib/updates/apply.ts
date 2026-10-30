import { createAdminSupabase } from '@/lib/supabase/server'
import { columnIndexToLetter } from '@/lib/sheets/a1'
import { fetchCellValue, updateCell } from '@/lib/sheets/client'
import {
  assertHeaderUnchanged,
  loadDataRows,
  loadSheetContext,
  type SheetContext,
} from '@/lib/sheets/context'
import { buildProjectLabel, describeIdentifier, findRowByIdentifier } from '@/lib/sheets/projects'
import { checkWritable, mappingByColumnIndex } from '@/lib/validation/writable'
import type {
  ApplyCellResult,
  ApplyProjectPayload,
  BatchStatus,
  LogStatus,
  VerificationStatus,
} from '@/lib/types'
import type { AuthContext } from '@/lib/auth/context'

/**
 * Google Sheets への反映処理。
 *
 * 流れ:
 *   1. ヘッダー構造の変更検知
 *   2. 対象案件を識別情報から再検索（解析時の行番号は信用しない）
 *   3. 対象セルの現在値を再取得し、確認画面表示時の値と照合（競合チェック）
 *   4. update_batch 作成（status = applying）
 *   5. old_value / new_value を sheet_update_logs へ保存（status = pending）
 *   6. 対象セルだけを更新
 *   7. 更新後に再取得して検証
 *   8. log / batch の status を確定
 */

export interface ApplyResult {
  batchId: string
  batchStatus: BatchStatus
  results: ApplyCellResult[]
  appliedCount: number
  failedCount: number
  conflictCount: number
}

interface PreparedCell {
  rowNumber: number
  columnIndex: number
  columnLetter: string
  columnName: string | null
  oldValue: string
  newValue: string
  projectLabel: string
  identifier: ApplyProjectPayload['identifier']
  /** 事前チェックで弾かれた場合の理由 */
  blockedReason: string | null
  blockedStatus: LogStatus | null
}

/** 反映直前の再取得と検証を行い、書き込み対象セルを確定します */
async function prepareCells(
  context: SheetContext,
  projects: ApplyProjectPayload[],
): Promise<PreparedCell[]> {
  const rows = await loadDataRows(context)
  const mappingMap = mappingByColumnIndex(context.mappings)
  const spreadsheetId = context.spreadsheetConnection.spreadsheet_id
  const sheetName = context.sheetConfig.sheet_name

  const prepared: PreparedCell[] = []

  for (const project of projects) {
    const { rowNumber, candidates } = findRowByIdentifier(project.identifier, rows)
    const projectLabel = describeIdentifier(project.identifier)

    // 案件が特定できない場合はこの案件のセルをすべて conflict にします
    if (rowNumber === null) {
      const reason =
        candidates.length > 1
          ? `対象案件が複数見つかりました（${candidates.length}件）。確認画面で案件を選び直してください。`
          : '対象案件がスプレッドシート上で見つかりませんでした。並び替え・削除の可能性があります。'

      project.cells.forEach((cell) => {
        const mapping = mappingMap.get(cell.columnIndex)
        prepared.push({
          rowNumber: project.identifier.observedRowNumber ?? 1,
          columnIndex: cell.columnIndex,
          columnLetter: columnIndexToLetter(cell.columnIndex),
          columnName: mapping?.column_name ?? null,
          oldValue: cell.observedOldValue,
          newValue: cell.newValue,
          projectLabel,
          identifier: project.identifier,
          blockedReason: reason,
          blockedStatus: 'conflict',
        })
      })
      continue
    }

    const currentRow = rows.find((row) => row.rowNumber === rowNumber)
    const label = currentRow
      ? buildProjectLabel(context.mappings, currentRow.cells)
      : projectLabel

    for (const cell of project.cells) {
      const mapping = mappingMap.get(cell.columnIndex)
      const writable = checkWritable(mapping)
      const columnLetter = columnIndexToLetter(cell.columnIndex)

      // 書き込み権限のサーバー側再検証
      if (!writable.writable) {
        prepared.push({
          rowNumber,
          columnIndex: cell.columnIndex,
          columnLetter,
          columnName: mapping?.column_name ?? null,
          oldValue: cell.observedOldValue,
          newValue: cell.newValue,
          projectLabel: label,
          identifier: project.identifier,
          blockedReason: `この列は更新できません（${writable.reason}）`,
          blockedStatus: 'failed',
        })
        continue
      }

      // 反映直前のセル現在値を取得して競合チェック
      const currentValue = await fetchCellValue(
        context.sheetsApi,
        spreadsheetId,
        sheetName,
        rowNumber,
        cell.columnIndex,
      )

      if (currentValue !== cell.observedOldValue) {
        prepared.push({
          rowNumber,
          columnIndex: cell.columnIndex,
          columnLetter,
          columnName: mapping?.column_name ?? null,
          oldValue: currentValue,
          newValue: cell.newValue,
          projectLabel: label,
          identifier: project.identifier,
          blockedReason:
            '確認後にスプレッドシートが変更されています。内容を再確認してください。' +
            `（確認時: ${cell.observedOldValue || '(空)'} / 現在: ${currentValue || '(空)'}）`,
          blockedStatus: 'conflict',
        })
        continue
      }

      prepared.push({
        rowNumber,
        columnIndex: cell.columnIndex,
        columnLetter,
        columnName: mapping?.column_name ?? null,
        oldValue: currentValue,
        newValue: cell.newValue,
        projectLabel: label,
        identifier: project.identifier,
        blockedReason: null,
        blockedStatus: null,
      })
    }
  }

  return prepared
}

/** batch 内の各 log の結果から batch 全体の status を決めます */
function resolveBatchStatus(statuses: LogStatus[]): BatchStatus {
  const applied = statuses.filter((status) => status === 'applied').length
  if (applied === statuses.length && statuses.length > 0) {
    return 'applied'
  }
  if (applied === 0) {
    return 'failed'
  }
  return 'partially_failed'
}

export async function applyUpdates(
  auth: AuthContext,
  sheetConfigId: string | undefined,
  projects: ApplyProjectPayload[],
): Promise<ApplyResult> {
  const context = await loadSheetContext(auth.organizationId, sheetConfigId)

  // 1. ヘッダー構造の変更検知（変更されていれば例外で停止）
  await assertHeaderUnchanged(context)

  // 2-3. 案件再検索 + セル現在値照合
  const prepared = await prepareCells(context, projects)
  if (prepared.length === 0) {
    throw new Error('反映対象がありません')
  }

  const admin = createAdminSupabase()
  const spreadsheetId = context.spreadsheetConnection.spreadsheet_id
  const sheetName = context.sheetConfig.sheet_name

  // 4. update_batch 作成
  const { data: batch, error: batchError } = await admin
    .from('update_batches')
    .insert({
      organization_id: auth.organizationId,
      user_id: auth.userId,
      spreadsheet_connection_id: context.spreadsheetConnection.id,
      sheet_config_id: context.sheetConfig.id,
      source_type: 'voice',
      status: 'applying',
    })
    .select('id')
    .single()

  if (batchError || !batch) {
    throw new Error(`更新バッチの作成に失敗しました: ${batchError?.message}`)
  }

  // 5. 変更前値を保存（status = pending）
  const { data: insertedLogs, error: logError } = await admin
    .from('sheet_update_logs')
    .insert(
      prepared.map((cell) => ({
        organization_id: auth.organizationId,
        update_batch_id: batch.id,
        user_id: auth.userId,
        spreadsheet_id: spreadsheetId,
        sheet_id: context.sheetConfig.sheet_id,
        sheet_name: sheetName,
        project_identifier: cell.identifier,
        row_number: cell.rowNumber,
        column_index: cell.columnIndex,
        column_letter: cell.columnLetter,
        column_name: cell.columnName,
        old_value: cell.oldValue,
        new_value: cell.newValue,
        status: 'pending',
        verification_status: 'pending',
      })),
    )
    .select('id')

  if (logError || !insertedLogs) {
    throw new Error(`変更履歴の保存に失敗しました: ${logError?.message}`)
  }

  // 6-7. 書き込み → 再取得検証
  const results: ApplyCellResult[] = []

  for (let i = 0; i < prepared.length; i += 1) {
    const cell = prepared[i]
    const logId = insertedLogs[i].id

    let status: LogStatus
    let verificationStatus: VerificationStatus
    let message: string | null = cell.blockedReason

    if (cell.blockedStatus) {
      status = cell.blockedStatus
      verificationStatus = 'failed'
    } else {
      try {
        await updateCell(
          context.sheetsApi,
          spreadsheetId,
          sheetName,
          cell.rowNumber,
          cell.columnIndex,
          cell.newValue,
        )

        const written = await fetchCellValue(
          context.sheetsApi,
          spreadsheetId,
          sheetName,
          cell.rowNumber,
          cell.columnIndex,
        )

        if (written === cell.newValue) {
          status = 'applied'
          verificationStatus = 'verified'
        } else {
          status = 'failed'
          verificationStatus = 'failed'
          message = `反映後の検証に失敗しました（期待値: ${cell.newValue} / 実際値: ${written}）`
        }
      } catch (error) {
        status = 'failed'
        verificationStatus = 'failed'
        message = error instanceof Error ? error.message : '書き込みに失敗しました'
      }
    }

    await admin
      .from('sheet_update_logs')
      .update({
        status,
        verification_status: verificationStatus,
        error_message: message,
        old_value: cell.oldValue,
      })
      .eq('id', logId)
      .eq('organization_id', auth.organizationId)

    results.push({
      columnIndex: cell.columnIndex,
      columnLetter: cell.columnLetter,
      columnName: cell.columnName,
      rowNumber: cell.rowNumber,
      oldValue: cell.oldValue,
      newValue: cell.newValue,
      status,
      verificationStatus,
      message,
      projectLabel: cell.projectLabel,
    })
  }

  // 8. batch status 確定
  const batchStatus = resolveBatchStatus(results.map((result) => result.status))
  await admin
    .from('update_batches')
    .update({ status: batchStatus })
    .eq('id', batch.id)
    .eq('organization_id', auth.organizationId)

  return {
    batchId: batch.id,
    batchStatus,
    results,
    appliedCount: results.filter((result) => result.status === 'applied').length,
    failedCount: results.filter((result) => result.status === 'failed').length,
    conflictCount: results.filter((result) => result.status === 'conflict').length,
  }
}
