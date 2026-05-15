'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell, Clock, Save, RefreshCw, Pin, ShoppingBag, Tag, Hash, Plus, X,
  Megaphone, Info, AlertTriangle, Loader2,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { CATEGORY_LIST, type CategoryCode } from '@/modules/category/category.keywords'

interface BandNoticeConfig {
  isEnabled: boolean
  scheduleTimes: string[]
  topN: number
  pinAsImportant: boolean
  retailChannelIds: number[]
  sourceChannelIds: number[]
  categoryCodes: string[]
  toneHint: string | null
  lastRunAt: string | null
  lastRunMessage: string | null
}

interface Channel {
  id: number
  name: string
  kind: 'WHOLESALE' | 'RETAIL'
}

const DEFAULT_CONFIG: BandNoticeConfig = {
  isEnabled: false,
  scheduleTimes: ['11:00', '13:00', '17:00'],
  topN: 5,
  pinAsImportant: true,
  retailChannelIds: [],
  sourceChannelIds: [],
  categoryCodes: [],
  toneHint: null,
  lastRunAt: null,
  lastRunMessage: null,
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function formatTime12(hhmm: string): string {
  const m = hhmm.match(HHMM_RE)
  if (!m) return hhmm
  const h = parseInt(m[1], 10)
  const mm = m[2]
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${ampm} ${h12}:${mm}`
}

function sortHHMM(arr: string[]): string[] {
  return [...new Set(arr)].sort()
}

export default function BandNoticeSettingsPage() {
  const toast = useToast()
  const [config, setConfig] = useState<BandNoticeConfig>(DEFAULT_CONFIG)
  const [initialConfig, setInitialConfig] = useState<BandNoticeConfig>(DEFAULT_CONFIG)
  const [retailChannels, setRetailChannels] = useState<Channel[]>([])
  const [wholesaleChannels, setWholesaleChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newTimeHour, setNewTimeHour] = useState<string>('')
  const [newTimeMinute, setNewTimeMinute] = useState<string>('00')

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [cfgRes, chRes] = await Promise.all([
        fetch('/api/admin/band-notice/config', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/channel?limit=200', { credentials: 'include', cache: 'no-store' }),
      ])
      const cfgJson = await cfgRes.json()
      const chJson = await chRes.json()
      if (cfgJson?.success && cfgJson.data) {
        setConfig(cfgJson.data)
        setInitialConfig(cfgJson.data)
      }
      if (chJson?.success && Array.isArray(chJson.data)) {
        const all: Channel[] = chJson.data.map((c: any) => ({ id: c.id, name: c.name, kind: c.kind }))
        setRetailChannels(all.filter((c) => c.kind === 'RETAIL'))
        setWholesaleChannels(all.filter((c) => c.kind === 'WHOLESALE'))
      }
    } catch (e: any) {
      toast.error(`불러오기 실패: ${e?.message || '네트워크 오류'}`)
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const hasChanges = JSON.stringify(config) !== JSON.stringify(initialConfig)

  const addTime = () => {
    const hh = newTimeHour.padStart(2, '0')
    const mm = newTimeMinute.padStart(2, '0')
    const t = `${hh}:${mm}`
    if (!HHMM_RE.test(t)) {
      toast.error('시간 형식이 올바르지 않습니다. (00:00 ~ 23:59)')
      return
    }
    if (config.scheduleTimes.includes(t)) {
      toast.error('이미 추가된 시간입니다.')
      return
    }
    setConfig({ ...config, scheduleTimes: sortHHMM([...config.scheduleTimes, t]) })
    setNewTimeHour('')
    setNewTimeMinute('00')
  }

  const removeTime = (t: string) => {
    setConfig({ ...config, scheduleTimes: config.scheduleTimes.filter((x) => x !== t) })
  }

  const toggleArrayValue = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

  const save = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/band-notice/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      })
      const json = await res.json()
      if (res.ok && json?.success && json.data) {
        setConfig(json.data)
        setInitialConfig(json.data)
        toast.success('밴드공지 설정이 저장되었습니다.')
      } else {
        toast.error(json?.error || '저장 실패')
      }
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.message || '네트워크 오류'}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 bg-gradient-to-br from-rose-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-200">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              밴드공지 설정
              {config.isEnabled ? (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700">ON</span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">OFF</span>
              )}
            </h1>
            <p className="text-sm text-gray-500">
              지정된 시각에 인기상품 Top N 을 소매밴드에 자동 공지합니다.
            </p>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            저장만 하면 즉시 발화되지 않습니다. 본 화면은 설정 영속화 단계 — MarketingAgent
            보강(개발계획서 Day 4-5) 완료 후 cron 이 본 설정을 읽어 자동 공지합니다.
          </div>
        </div>
      </div>

      {/* 활성화 토글 */}
      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-rose-500" />
            <div>
              <div className="font-bold text-gray-900">밴드공지 활성화</div>
              <div className="text-xs text-gray-500">
                꺼두면 cron 이 발화하지 않습니다 (수동 트리거는 별도)
              </div>
            </div>
          </div>
          <button
            onClick={() => setConfig({ ...config, isEnabled: !config.isEnabled })}
            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-300 ${
              config.isEnabled ? 'bg-rose-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                config.isEnabled ? 'translate-x-9' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </Card>

      {/* 공지 시간 */}
      <Card className="mb-4 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-violet-500" />
          <h2 className="text-base font-bold text-gray-900">공지 시간</h2>
          <span className="text-xs text-gray-500">
            ({config.scheduleTimes.length}회/일) — 24시간제 HH:MM
          </span>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <input
            type="number"
            min={0}
            max={23}
            value={newTimeHour}
            onChange={(e) => setNewTimeHour(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder="시"
            className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
          <span className="text-gray-400">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={newTimeMinute}
            onChange={(e) => setNewTimeMinute(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder="분"
            className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
          <button
            onClick={addTime}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-violet-50 text-violet-700 hover:bg-violet-100 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            추가
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.scheduleTimes.length === 0 ? (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              공지 시간이 없습니다 — 활성화하려면 1개 이상 입력하세요.
            </span>
          ) : (
            config.scheduleTimes.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-800 text-xs font-medium"
              >
                {formatTime12(t)} <span className="text-violet-500">({t})</span>
                <button onClick={() => removeTime(t)} className="hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </Card>

      {/* Top N + 중요공지 */}
      <Card className="mb-4 p-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-5 h-5 text-emerald-500" />
              <h2 className="text-base font-bold text-gray-900">노출할 상품 수 (Top N)</h2>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={10}
                value={config.topN}
                onChange={(e) => setConfig({
                  ...config,
                  topN: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)),
                })}
                className="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded-md"
              />
              <span className="text-sm text-gray-500">개 (1~10)</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">인기상품 Top {config.topN} 을 게시글에 포함</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Pin className={`w-5 h-5 ${config.pinAsImportant ? 'text-amber-500' : 'text-gray-400'}`} />
              <h2 className="text-base font-bold text-gray-900">중요공지로 게시</h2>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.pinAsImportant}
                onChange={(e) => setConfig({ ...config, pinAsImportant: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">밴드 상단 고정 (해제 시 일반 게시글)</span>
            </label>
            <p className="text-xs text-gray-400 mt-1">
              MarketingAgent 가 다음 공지 발행 시 자동으로 이전 중요공지를 해제하고 새 글을 고정합니다.
            </p>
          </div>
        </div>
      </Card>

      {/* 발행 대상 소매밴드 */}
      <Card className="mb-4 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-bold text-gray-900">발행 대상 소매밴드</h2>
          <span className="text-xs text-gray-500">
            ({config.retailChannelIds.length === 0 ? '전체' : `${config.retailChannelIds.length}개`})
          </span>
        </div>
        {retailChannels.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 소매밴드가 없습니다.</p>
        ) : (
          <>
            <div className="mb-2 flex gap-2">
              <button
                onClick={() => setConfig({ ...config, retailChannelIds: [] })}
                className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                전체 선택 (비우기)
              </button>
              <button
                onClick={() => setConfig({ ...config, retailChannelIds: retailChannels.map((c) => c.id) })}
                className="text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700"
              >
                모두 명시 선택
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {retailChannels.map((c) => {
                const selected = config.retailChannelIds.includes(c.id)
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      selected
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => setConfig({
                        ...config,
                        retailChannelIds: toggleArrayValue(config.retailChannelIds, c.id),
                      })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-900 truncate">{c.name}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              빈 선택 = 모든 활성 소매밴드. 일부만 명시하면 해당 채널에만 공지.
            </p>
          </>
        )}
      </Card>

      {/* 도매방 출처 필터 */}
      <Card className="mb-4 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag className="w-5 h-5 text-amber-600" />
          <h2 className="text-base font-bold text-gray-900">도매방 출처 필터</h2>
          <span className="text-xs text-gray-500">
            ({config.sourceChannelIds.length === 0 ? '전체' : `${config.sourceChannelIds.length}개`})
          </span>
        </div>
        {wholesaleChannels.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 도매방이 없습니다.</p>
        ) : (
          <>
            <div className="mb-2 flex gap-2">
              <button
                onClick={() => setConfig({ ...config, sourceChannelIds: [] })}
                className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                전체 (비우기)
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {wholesaleChannels.map((c) => {
                const selected = config.sourceChannelIds.includes(c.id)
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      selected
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => setConfig({
                        ...config,
                        sourceChannelIds: toggleArrayValue(config.sourceChannelIds, c.id),
                      })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-900 truncate">{c.name}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              빈 선택 = 모든 도매방 상품 후보. 선택 시 해당 도매방에서 가져온 상품만 인기순위 대상.
            </p>
          </>
        )}
      </Card>

      {/* 카테고리 필터 */}
      <Card className="mb-4 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-5 h-5 text-purple-500" />
          <h2 className="text-base font-bold text-gray-900">카테고리 필터</h2>
          <span className="text-xs text-gray-500">
            ({config.categoryCodes.length === 0 ? '전체' : `${config.categoryCodes.length}개`})
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_LIST.map((cat) => {
            const selected = config.categoryCodes.includes(cat.code)
            return (
              <button
                key={cat.code}
                onClick={() => setConfig({
                  ...config,
                  categoryCodes: toggleArrayValue(config.categoryCodes, cat.code as CategoryCode),
                })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selected
                    ? 'bg-purple-100 border-purple-400 text-purple-800'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {cat.emoji} {cat.name}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          빈 선택 = 전체 카테고리. 선택 시 해당 카테고리 상품만 인기순위 대상.
        </p>
      </Card>

      {/* 톤 힌트 (옵션) */}
      <Card className="mb-4 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-gray-500" />
          <h2 className="text-base font-bold text-gray-900">문구 톤 힌트 (옵션)</h2>
        </div>
        <textarea
          value={config.toneHint || ''}
          onChange={(e) => setConfig({ ...config, toneHint: e.target.value })}
          placeholder="예: '신선/오늘 잡은' 느낌 강조. 이모지 적당히. 가격 강조 X."
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none"
          maxLength={500}
        />
        <p className="text-xs text-gray-400 mt-1">
          Gemini 문구 생성 시 시스템 프롬프트에 함께 전달됩니다. (최대 500자)
        </p>
      </Card>

      {/* 마지막 실행 정보 */}
      {(config.lastRunAt || config.lastRunMessage) && (
        <Card className="mb-4 p-4 bg-gray-50">
          <div className="text-xs text-gray-500">
            <div className="font-medium mb-1">마지막 실행</div>
            {config.lastRunAt && (
              <div>시각: {new Date(config.lastRunAt).toLocaleString('ko-KR')}</div>
            )}
            {config.lastRunMessage && (
              <div className="mt-1 text-gray-700 whitespace-pre-line">{config.lastRunMessage}</div>
            )}
          </div>
        </Card>
      )}

      {/* 저장 바 (sticky bottom) */}
      <div className="sticky bottom-4 mt-6">
        <Card className="p-3 flex items-center justify-between gap-3 shadow-xl">
          <div className="text-xs text-gray-500">
            {hasChanges ? (
              <span className="text-amber-700 font-medium">⚠ 저장되지 않은 변경사항이 있습니다</span>
            ) : (
              '저장됨'
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={load}
              disabled={isSaving}
              className="flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              다시 불러오기
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              저장
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
