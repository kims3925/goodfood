/**
 * 어드민 — 통합 셀러 관리
 * Pro / Lite / Lite Band 사용자를 한 화면에서 모니터링 + mode 변경 + 활성화/비활성화.
 *
 * 신규 셀러 발급은 /admin/lite/sellers (Lite/Lite Band 전용 발급 폼) 으로 이동.
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  Search,
  ShoppingBag,
  Radio,
  Power,
  ExternalLink,
  Plus,
  Filter,
} from 'lucide-react'

type Mode = 'all' | 'pro' | 'lite' | 'lite_band'

interface Seller {
  id: number
  email: string
  name: string | null
  phone: string | null
  mode: string
  maxShops: number
  role: string
  liteStartAt: string | null
  proStartAt: string | null
  createdAt: string
  deletedAt: string | null
  shops: Array<{
    id: number
    name: string
    subdomain: string
    managerName: string | null
    adminLoginId: string | null
    isActive: boolean
  }>
  channels: Array<{
    id: number
    name: string
    channelKey: string
    sessionExpiresAt: string | null
  }>
  liteAutoPublishConfig: {
    publishHour: number
    publishMinute: number
    dailyCount: number
    isActive: boolean
    lastRunAt: string | null
  } | null
}

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  pro: { label: '🚀 Pro', color: 'bg-purple-100 text-purple-700' },
  lite: { label: '✨ Lite', color: 'bg-blue-100 text-blue-700' },
  lite_band: { label: '📡 Lite Band', color: 'bg-green-100 text-green-700' },
}

export default function AdminUnifiedSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [counts, setCounts] = useState({ all: 0, pro: 0, lite: 0, lite_band: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Mode>('all')
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (filter !== 'all') qs.set('mode', filter)
      if (search) qs.set('search', search)
      if (includeInactive) qs.set('includeInactive', '1')
      const res = await fetch(`/api/admin/users/sellers?${qs.toString()}`, {
        credentials: 'include',
      }).then((r) => r.json())
      if (res.success) {
        setSellers(res.data.users || [])
        setCounts(res.data.counts || { all: 0, pro: 0, lite: 0, lite_band: 0 })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filter, includeInactive])

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    load()
  }

  async function changeMode(id: number, mode: string) {
    if (!confirm(`사용자 ${id}의 mode를 ${mode}로 변경할까요?`)) return
    const res = await fetch(`/api/admin/users/sellers/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    }).then((r) => r.json())
    if (res.success) await load()
    else alert(res.error || '실패')
  }

  async function changeMaxShops(id: number, currentMax: number) {
    const display = currentMax >= 9999 ? '무제한' : `${currentMax}개`
    const input = prompt(
      `최대 쇼핑몰 수를 입력하세요 (현재 ${display})\n` +
        '- 숫자 입력: 해당 개수까지 허용\n' +
        '- "무제한" 또는 0 입력: 한도 없음 (9999 로 설정)',
      currentMax >= 9999 ? '무제한' : String(currentMax)
    )
    if (input === null) return
    const trimmed = input.trim()
    let value: number
    if (trimmed === '무제한' || trimmed === '0' || trimmed === '') {
      value = 9999
    } else {
      const n = Number(trimmed)
      if (!Number.isFinite(n) || n < 1) {
        alert('1 이상의 정수, 또는 "무제한" 을 입력하세요.')
        return
      }
      value = Math.floor(n)
    }
    const res = await fetch(`/api/admin/users/sellers/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxShops: value }),
    }).then((r) => r.json())
    if (res.success) await load()
    else alert(res.error || '실패')
  }

  async function toggleActive(id: number, currentlyActive: boolean) {
    const action = currentlyActive ? '정지' : '활성화'
    if (!confirm(`사용자 ${id}를 ${action}할까요?`)) return
    const res = await fetch(`/api/admin/users/sellers/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentlyActive }),
    }).then((r) => r.json())
    if (res.success) await load()
    else alert(res.error || '실패')
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            통합 셀러 관리
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Pro / Lite / Lite Band 사용자를 한 곳에서 관리하고 mode를 전환합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/shops/publish"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" /> 쇼핑몰 발행
          </Link>
          <Link
            href="/admin/lite/sellers"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> 신규 Lite 셀러 발급
          </Link>
        </div>
      </header>

      {/* 모드 필터 탭 */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <FilterTab
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="전체"
          count={counts.all}
        />
        <FilterTab
          active={filter === 'pro'}
          onClick={() => setFilter('pro')}
          label="🚀 Pro"
          count={counts.pro}
          accent="purple"
        />
        <FilterTab
          active={filter === 'lite'}
          onClick={() => setFilter('lite')}
          label="✨ Lite"
          count={counts.lite}
          accent="blue"
        />
        <FilterTab
          active={filter === 'lite_band'}
          onClick={() => setFilter('lite_band')}
          label="📡 Lite Band"
          count={counts.lite_band}
          accent="green"
        />
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-2 mb-4">
        <form onSubmit={onSearchSubmit} className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이메일 / 이름 / 쇼핑몰명 / URL"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </form>
        <label className="text-sm text-gray-700 flex items-center gap-1">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          정지 사용자 포함
        </label>
      </div>

      {loading && <div className="text-center text-gray-500 py-12">로딩 중...</div>}

      {!loading && sellers.length === 0 && (
        <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">
          조건에 맞는 셀러가 없습니다.
        </div>
      )}

      {!loading && sellers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-700">
              <tr className="text-left">
                <th className="px-3 py-2">사용자</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">쇼핑몰</th>
                <th className="px-3 py-2">한도</th>
                <th className="px-3 py-2">Band 채널</th>
                <th className="px-3 py-2">자동 발행</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => {
                const m = MODE_LABELS[s.mode] || { label: s.mode, color: 'bg-gray-100 text-gray-700' }
                const isActive = s.deletedAt == null
                return (
                  <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.name || '(이름 없음)'}</div>
                      <div className="text-xs text-gray-500">{s.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={s.mode}
                        onChange={(e) => changeMode(s.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded font-medium ${m.color} border-0 cursor-pointer`}
                      >
                        <option value="pro">🚀 Pro</option>
                        <option value="lite">✨ Lite</option>
                        <option value="lite_band">📡 Lite Band</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {s.shops.length > 0 ? (
                        <div className="text-xs">
                          <div className="flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3 text-gray-400" />
                            <span>{s.shops[0].name}</span>
                            <span className="text-gray-400">/{s.shops[0].subdomain}</span>
                          </div>
                          {s.shops.length > 1 && (
                            <div className="text-[10px] text-gray-500 ml-4">
                              +{s.shops.length - 1}개 더
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.mode === 'pro' ? (
                        <button
                          onClick={() => changeMaxShops(s.id, s.maxShops)}
                          className="px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium"
                          title="클릭하여 변경"
                        >
                          {s.shops.length} / {s.maxShops >= 9999 ? '∞ 무제한' : s.maxShops}
                        </button>
                      ) : (
                        <span className="text-gray-500">
                          {s.shops.length} / 1
                          <span className="block text-[10px] text-gray-400">라이트 1:1</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {s.channels.length > 0 ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Radio className="w-3 h-3 text-green-500" />
                          <span>{s.channels[0].name}</span>
                          {s.channels.length > 1 && (
                            <span className="text-gray-400"> +{s.channels.length - 1}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.liteAutoPublishConfig ? (
                        <div>
                          <span
                            className={
                              s.liteAutoPublishConfig.isActive
                                ? 'text-green-600 font-medium'
                                : 'text-gray-400'
                            }
                          >
                            {s.liteAutoPublishConfig.isActive ? 'ON' : 'OFF'}
                          </span>{' '}
                          {String(s.liteAutoPublishConfig.publishHour).padStart(2, '0')}:
                          {String(s.liteAutoPublishConfig.publishMinute).padStart(2, '0')} ·{' '}
                          {s.liteAutoPublishConfig.dailyCount}개
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {isActive ? '활성' : '정지'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {(s.mode === 'lite' || s.mode === 'lite_band') && (
                          <Link
                            href={`/admin/lite/sellers`}
                            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            상세
                          </Link>
                        )}
                        <button
                          onClick={() => toggleActive(s.id, isActive)}
                          className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                            isActive
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {isActive ? '정지' : '활성'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FilterTab({
  active,
  onClick,
  label,
  count,
  accent,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  accent?: 'purple' | 'blue' | 'green'
}) {
  const accentColors = {
    purple: 'bg-purple-600 text-white',
    blue: 'bg-blue-600 text-white',
    green: 'bg-green-600 text-white',
  }
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 rounded-lg text-sm font-medium border ${
        active
          ? accent
            ? accentColors[accent]
            : 'bg-gray-800 text-white border-gray-800'
          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
      }`}
    >
      <div>{label}</div>
      <div className={`text-xs mt-0.5 ${active ? 'opacity-90' : 'text-gray-500'}`}>
        {count}명
      </div>
    </button>
  )
}
