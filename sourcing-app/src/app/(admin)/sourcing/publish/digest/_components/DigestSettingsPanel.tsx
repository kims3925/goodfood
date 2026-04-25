'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react'

export type GridSize = '3x4' | '3x3' | '2x3' | 'custom'

export interface CollageSettingsValue {
  collageTitle: string
  topBadgeText: string
  gridSize: GridSize
  /** gridSize === 'custom'일 때만 사용 (1~5). */
  customCols?: number
  /** gridSize === 'custom'일 때만 사용 (1~5). */
  customRows?: number
  removeBackground: boolean
}

interface Props {
  value: CollageSettingsValue
  onChange: (next: CollageSettingsValue) => void
  shopCategoryUrl?: string
  defaultTitle: string
  /** 펼침 상태를 외부 제어. 미지정 시 내부 상태 사용 */
  open?: boolean
  onToggle?: (open: boolean) => void
}

const GRID_OPTIONS: Array<{ value: Exclude<GridSize, 'custom'>; label: string; count: number }> = [
  { value: '3x4', label: '3 × 4 (12개)', count: 12 },
  { value: '3x3', label: '3 × 3 (9개)', count: 9 },
  { value: '2x3', label: '2 × 3 (6개)', count: 6 },
]

// 직접 입력 제약 — 각 축 1~5, 총 셀 2~20 (Band 첨부 제약, 렌더러 메모리 고려)
export const CUSTOM_MIN_AXIS = 1
export const CUSTOM_MAX_AXIS = 5
export const CUSTOM_MIN_CELLS = 2
export const CUSTOM_MAX_CELLS = 20

function clampAxis(n: number): number {
  if (!Number.isFinite(n)) return 3
  return Math.max(CUSTOM_MIN_AXIS, Math.min(CUSTOM_MAX_AXIS, Math.floor(n)))
}

/**
 * 설정값에서 실제 (cols, rows, count)를 해석.
 * gridSize === 'custom'이면 customCols/customRows를 사용, 없으면 3×3로 폴백.
 */
export function getGridDims(value: CollageSettingsValue): {
  cols: number
  rows: number
  count: number
} {
  if (value.gridSize === 'custom') {
    const cols = clampAxis(value.customCols ?? 3)
    const rows = clampAxis(value.customRows ?? 3)
    return { cols, rows, count: cols * rows }
  }
  const preset = GRID_OPTIONS.find((o) => o.value === value.gridSize)
  if (preset) {
    if (preset.value === '3x3') return { cols: 3, rows: 3, count: 9 }
    if (preset.value === '2x3') return { cols: 2, rows: 3, count: 6 }
    return { cols: 3, rows: 4, count: 12 }
  }
  return { cols: 3, rows: 4, count: 12 }
}

// Deprecated: 레거시 사용처(콜 사이트 없으면 추후 제거). getGridDims 사용 권장.
export function gridSizeToCount(size: GridSize): number {
  if (size === 'custom') return 9
  return GRID_OPTIONS.find((o) => o.value === size)?.count ?? 12
}

export function gridSizeToColsRows(size: GridSize): { cols: number; rows: number } {
  if (size === '3x3') return { cols: 3, rows: 3 }
  if (size === '2x3') return { cols: 2, rows: 3 }
  if (size === 'custom') return { cols: 3, rows: 3 }
  return { cols: 3, rows: 4 }
}

export default function DigestSettingsPanel({
  value,
  onChange,
  shopCategoryUrl,
  defaultTitle,
  open: openProp,
  onToggle,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = (next: boolean) => {
    if (onToggle) onToggle(next)
    else setInternalOpen(next)
  }

  const update = <K extends keyof CollageSettingsValue>(key: K, v: CollageSettingsValue[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="mb-4 bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-gray-600" />
          <span className="text-sm font-semibold text-gray-800">📋 발행조건 설정 (콜라주 모드)</span>
          <span className="text-xs text-gray-500">
            {value.gridSize} · {value.removeBackground ? '배경제거 ON' : '배경제거 OFF'}
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100 bg-gray-50">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              포스터 제목
            </label>
            <input
              type="text"
              value={value.collageTitle}
              onChange={(e) => update('collageTitle', e.target.value)}
              placeholder={defaultTitle}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              비워두면 카테고리에 따라 자동 생성: <code className="text-gray-700">{defaultTitle}</code>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              우상단 강조 배지 (선택)
            </label>
            <input
              type="text"
              value={value.topBadgeText}
              onChange={(e) => update('topBadgeText', e.target.value)}
              placeholder="예: 지금이 득템기회 🫵 (비워두면 표시 안 함)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              그리드 크기
            </label>
            <div className="flex gap-2 flex-wrap">
              {GRID_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('gridSize', opt.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    value.gridSize === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    gridSize: 'custom',
                    customCols: value.customCols ?? 3,
                    customRows: value.customRows ?? 3,
                  })
                }
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  value.gridSize === 'custom'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
              >
                ✏️ 직접 입력
              </button>
            </div>

            {value.gridSize === 'custom' && (
              <div className="mt-2 flex items-center gap-2 flex-wrap bg-white border border-gray-200 rounded-md px-3 py-2">
                <span className="text-[11px] text-gray-500">가로</span>
                <input
                  type="number"
                  min={CUSTOM_MIN_AXIS}
                  max={CUSTOM_MAX_AXIS}
                  value={value.customCols ?? 3}
                  onChange={(e) =>
                    update('customCols', clampAxis(parseInt(e.target.value, 10)))
                  }
                  className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">×</span>
                <span className="text-[11px] text-gray-500">세로</span>
                <input
                  type="number"
                  min={CUSTOM_MIN_AXIS}
                  max={CUSTOM_MAX_AXIS}
                  value={value.customRows ?? 3}
                  onChange={(e) =>
                    update('customRows', clampAxis(parseInt(e.target.value, 10)))
                  }
                  className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {(() => {
                  const dims = getGridDims(value)
                  const warn =
                    dims.count < CUSTOM_MIN_CELLS || dims.count > CUSTOM_MAX_CELLS
                  return (
                    <span
                      className={`text-xs font-semibold ${
                        warn ? 'text-red-600' : 'text-blue-600'
                      }`}
                    >
                      = {dims.count}개
                      {warn && ` (${CUSTOM_MIN_CELLS}~${CUSTOM_MAX_CELLS} 범위)`}
                    </span>
                  )
                })()}
              </div>
            )}

            <p className="mt-1 text-[11px] text-gray-500">
              선택한 그리드와 정확히 같은 수의 상품을 선택해야 콜라주 발행이 활성화됩니다.
              직접 입력은 가로·세로 각 {CUSTOM_MIN_AXIS}~{CUSTOM_MAX_AXIS}, 총 {CUSTOM_MIN_CELLS}~{CUSTOM_MAX_CELLS}셀까지.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={value.removeBackground}
                onChange={(e) => update('removeBackground', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span>배경 제거 (각 상품 이미지)</span>
              <span className="text-[11px] text-gray-500">— 끄면 원본 이미지 그대로 합성</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              쇼핑몰 카테고리 링크 (자동)
            </label>
            <div className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-md text-gray-700 break-all">
              {shopCategoryUrl ? (
                <a href={shopCategoryUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  {shopCategoryUrl}
                </a>
              ) : (
                <span className="text-gray-400">현재 카테고리에 연결된 쇼핑몰이 없습니다 (subdomain 없음)</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              밴드 본문에 위 링크 1줄만 들어갑니다. 상품별 링크는 표시되지 않습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
