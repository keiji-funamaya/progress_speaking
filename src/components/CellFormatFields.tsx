'use client'

import { Label, Select } from '@/components/ui'
import { HORIZONTAL_ALIGN_LABEL } from '@/lib/format'
import type { CellFormat, HorizontalAlign } from '@/lib/types'

/** 文字色を「指定する」にしたときの初期色 */
const DEFAULT_TEXT_COLOR = '#FF0000'

/**
 * 反映時のセル書式（文字色・横方向の配置・太字）の入力欄。
 * 設定画面（列の事前設定）と確認画面（セルごとの個別指定）で共通利用します。
 * 各項目の null は「指定なし（スプレッドシートの書式を変更しない）」を表します。
 */
export function CellFormatFields({
  value,
  onChange,
}: {
  value: CellFormat
  onChange: (next: CellFormat) => void
}) {
  function patch(next: Partial<CellFormat>) {
    onChange({ ...value, ...next })
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <div>
        <Label>文字色</Label>
        <div className="flex h-[42px] items-center gap-2 text-sm text-[#42526e]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.textColor !== null}
              onChange={(e) => patch({ textColor: e.target.checked ? DEFAULT_TEXT_COLOR : null })}
            />
            指定する
          </label>
          {value.textColor !== null ? (
            <input
              type="color"
              value={value.textColor}
              onChange={(e) => patch({ textColor: e.target.value.toUpperCase() })}
              className="h-8 w-10 cursor-pointer rounded-[3px] border border-[#dfe1e6] bg-white"
              aria-label="文字色"
            />
          ) : null}
        </div>
      </div>

      <div>
        <Label>横方向の配置</Label>
        <Select
          value={value.horizontalAlign ?? ''}
          onChange={(e) =>
            patch({ horizontalAlign: (e.target.value || null) as HorizontalAlign | null })
          }
        >
          <option value="">指定なし</option>
          {(Object.keys(HORIZONTAL_ALIGN_LABEL) as HorizontalAlign[]).map((align) => (
            <option key={align} value={align}>
              {HORIZONTAL_ALIGN_LABEL[align]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>太字</Label>
        <label className="flex h-[42px] items-center gap-2 text-sm text-[#42526e]">
          <input
            type="checkbox"
            checked={value.bold === true}
            onChange={(e) => patch({ bold: e.target.checked ? true : null })}
          />
          太字にする
        </label>
      </div>
    </div>
  )
}
