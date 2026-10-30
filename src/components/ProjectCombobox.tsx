'use client'

import { useMemo, useState } from 'react'
import { TextInput } from '@/components/ui'
import type { ProjectRow } from '@/lib/types'

/**
 * 検索可能な案件選択 Combobox。
 * 同姓同名でも区別できるよう、複数列を連結したラベルを表示します。
 */
export function ProjectCombobox({
  projects,
  selectedRowNumber,
  onSelect,
}: {
  projects: ProjectRow[]
  selectedRowNumber: number | null
  onSelect: (project: ProjectRow) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = useMemo(
    () => projects.find((project) => project.rowNumber === selectedRowNumber) ?? null,
    [projects, selectedRowNumber],
  )

  const filtered = useMemo(() => {
    const keyword = query.replace(/[\s　]/g, '').toLowerCase()
    if (keyword === '') {
      return projects.slice(0, 50)
    }
    return projects
      .filter((project) => project.label.replace(/[\s　]/g, '').toLowerCase().includes(keyword))
      .slice(0, 50)
  }, [projects, query])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-[3px] border border-[#dfe1e6] bg-[#fafbfc] px-3 py-2 text-left text-[#172b4d] hover:bg-white"
      >
        {selected ? selected.label : '案件を選択してください'}
        <span className="float-right text-[#5e6c84]">▼</span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-[3px] border border-[#dfe1e6] bg-white shadow-lg">
          <div className="p-2">
            <TextInput
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="案件名・顧客名で検索"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#5e6c84]">該当する案件がありません</li>
            ) : (
              filtered.map((project) => (
                <li key={project.rowNumber}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(project)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={[
                      'block w-full px-3 py-2 text-left text-sm hover:bg-[#e9f2ff]',
                      project.rowNumber === selectedRowNumber ? 'bg-[#deebff]' : '',
                    ].join(' ')}
                  >
                    {project.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
