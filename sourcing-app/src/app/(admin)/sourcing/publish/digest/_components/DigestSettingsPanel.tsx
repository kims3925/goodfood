'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react'

export type GridSize = '3x4' | '3x3' | '2x3' | 'custom'

/**
 * 콜라주 설정값.
 *
 * 모델은 2가지가 공존한다:
 * 1. 레거시 grid 모드 — gridSize('3x4'|'3x3'|'2x3'|'custom') + customCols/customRows.
 *    `/sourcing/publish/digest` 페이지가 이 방식을 계속 사용.
 * 2. 신규 count 모드 — targetCount(1~TARGET_MAX)만 지정하면 autoLayout이
 *    cols/rows를 자동 계산. 광고 페이지 CollageTab이 이 방식을 사용.
 *
 * `getGridDims(value)`는 targetCount가 정의되어 있으면 1번보다 우선한다.
 */
export type ShopLinkMode = 'auto' | 'main' | 'category'

export interface CollageSettingsValue {
  collageTitle: string
  topBadgeText: string
  gridSize: GridSize
  /** gridSize === 'custom'일 때만 사용 (1~5). */
  customCols?: number
  /** gridSize === 'custom'일 때만 사용 (1~5). */
  customRows?: number
  /**
   * 신규 count 모드 전용. 정의되어 있으면 gridSize/customCols/customRows보다
   * 우선해서 자동 그리드가 계산된다. 1 ~ TARGET_MAX.
   */
  targetCount?: number
  removeBackground: boolean
  /**
   * 쇼핑몰 링크 모드 (콜라주 본문 하단 URL).
   * - 'auto'(기본): 단일 카테고리는 카테고리 페이지, 2개 이상이면 쇼핑몰 메인.
   * - 'main': 항상 쇼핑몰 메인.
   * - 'category': 항상 카테고리 페이지(linkCategoryCode 사용).
   */
  shopLinkMode?: ShopLinkMode
  /** category 모드에서 사용할 카테고리 코드. */
  linkCategoryCode?: string
}

interface Props {
  value: CollageSettingsValue
  onChange: (next: CollageSettingsValue) => void
  shopCategoryUrl?: string
  defaultTitle: string
  /**
   * 설정 패널 모드.
   * - 'grid'(기본): 기존 프리셋/직접입력 버튼 방식 (레거시 digest 페이지)
   * - 'count': 목표 개수만 입력 + 자동 레이아웃 (신규 광고 페이지 CollageTab)
   */
  mode?: 'grid' | 'count'
  /**
   * 'category' 링크 모드 dropdown 옵션.
   * 보통 사용자가 체크한 카테고리 목록을 전달.
   */
  linkCategoryOptions?: Array<{ code: string; name: string; emoji: string }>
  /** 펼침 상태를 외부 제어. 미지정 시 내부 상태 사용 */
  open?: boolean
  onToggle?: (open: boolean) => void
}

const GRID_OPTIONS: Array<{ value: Exclude<GridSize, 'custom'>; label: string; count: number }> = [
  { value: '3x4', label: '3 × 4 (12개)', count: 12 },
  { value: '3x3', label: '3 × 3 (9개)', count: 9 },
  { value: '2x3', label: '2 × 3 (6개)', count: 6 },
]

// 레거시 직접 입력 제약
export const CUSTOM_MIN_AXIS = 1
export const CUSTOM_MAX_AXIS = 5
export const CUSTOM_MIN_CELLS = 2
export const CUSTOM_MAX_CELLS = 20

// 신규 count 모드 범위
export const TARGET_MIN = 1
export const TARGET_MAX = 12
const COUNT_PRESETS: number[] = [12, 9, 6, 4, 2]

function clampAxis(n: number): number {
  if (!Number.isFinite(n)) return 3
  return Math.max(CUSTOM_MIN_AXIS, Math.min(CUSTOM_MAX_AXIS, Math.floor(n)))
}

export function clampTargetCount(n: number): number {
  if (!Number.isFinite(n)) return TARGET_MAX
  return Math.max(TARGET_MIN, Math.min(TARGET_MAX, Math.floor(n)))
}

/**
 * 목표 개수 n에 대해 가장 균형잡힌 (cols, rows) 자동 산출.
 * cols = ceil(sqrt(n)), rows = ceil(n/cols).
 * 예: 1→1x1, 4→2x2, 6→3x2, 9→3x3, 12→4x3.
 * 부족 셀(cols*rows - n)은 렌더러에서 숨김 placeholder로 처리.
 */
export function autoLayoutFromCount(n: number): { cols: number; rows: number } {
  const count = clampTargetCount(n)
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
  const rows = Math.max(1, Math.ceil(count / cols))
  return { cols, rows }
}

/**
 * 설정값에서 실제 (cols, rows, count)를 해석.
 *
 * 우선순위:
 *   1. targetCount 정의되어 있으면 autoLayout(targetCount)
 *   2. gridSize === 'custom' 이면 customCols/customRows
 *   3. gridSize 프리셋 (3x4/3x3/2x3)
 */
export function getGridDims(value: CollageSettingsValue): {
  cols: number
  rows: number
  count: number
} {
  if (value.targetCount != null) {
    const target = clampTargetCount(value.targetCount)
    const { cols, rows } = autoLayoutFromCount(target)
    return { cols, rows, count: target }
  }
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

// Deprecated: 레거시 사용처 호환용. 새 코드는 getGridDims 사용 권장.
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
  mode = 'grid',
  linkCategoryOptions,
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

  const dims = getGridDims(value)

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
            {mode === 'count'
              ? `${dims.count}개 (${dims.cols}×${dims.rows} 자동)`
              : value.gridSize}{' '}
            · {value.removeBackground ? '배경제거 ON' : '배경제거 OFF'}
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

          {/* ─── 그리드 입력 — mode별 분기 ─── */}
          {mode === 'count' ? (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                발행 개수 ({TARGET_MIN}~{TARGET_MAX})
              </label>
              <div className="flex gap-2 flex-wrap items-center">
                {COUNT_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => update('targetCount', n)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      dims.count === n
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {n}개
                  </button>
                ))}
                <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md px-2 py-1">
                  <span className="text-[11px] text-gray-500">직접</span>
                  <input
                    type="number"
                    min={TARGET_MIN}
                    max={TARGET_MAX}
                    value={dims.count}
                    onChange={(e) =>
                      update('targetCount', clampTargetCount(parseInt(e.target.value, 10)))
                    }
                    className="w-14 text-sm px-1 py-0.5 text-center focus:outline-none"
                  />
                  <span className="text-[11px] text-gray-500">개</span>
                </div>
                <span className="text-xs text-blue-600 font-semibold ml-1">
                  → 자동 배치 {dims.cols} × {dims.rows}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                선택한 개수만큼 상품을 체크하면 발행할 수 있습니다. 셀 개수(cols × rows)가 목표보다 크면 남는 셀은 빈 공간으로 처리됩니다.
              </p>
            </div>
          ) : (
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
          )}

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
              쇼핑몰 링크
            </label>
            <div className="flex gap-2 flex-wrap items-center">
              {(
                [
                  { v: 'auto', label: '자동' },
                  { v: 'main', label: '쇼핑몰 메인' },
                  { v: 'category', label: '카테고리 페이지' },
                ] as const
              ).map((opt) => {
                const active = (value.shopLinkMode || 'auto') === opt.v
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => update('shopLinkMode', opt.v)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
              {value.shopLinkMode === 'category' &&
                linkCategoryOptions &&
                linkCategoryOptions.length > 0 && (
                  <select
                    value={value.linkCategoryCode || linkCategoryOptions[0].code}
                    onChange={(e) => update('linkCategoryCode', e.target.value)}
                    className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {linkCategoryOptions.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>
                )}
            </div>
            <div className="mt-2 px-3 py-2 text-xs bg-white border border-gray-200 rounded-md text-gray-700 break-all">
              {shopCategoryUrl ? (
                <a
                  href={shopCategoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {shopCategoryUrl}
                </a>
              ) : (
                <span className="text-gray-400">
                  연결된 쇼핑몰이 없습니다 (밴드의 매핑 또는 첫 상품 subdomain 필요).
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              자동: 1개 카테고리 발행 시 카테고리 페이지, 2개 이상은 쇼핑몰 메인.
              실제 도메인은 발행 대상 밴드와 매핑된 쇼핑몰을 우선 사용합니다 (각 밴드별로 다를 수 있음).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
