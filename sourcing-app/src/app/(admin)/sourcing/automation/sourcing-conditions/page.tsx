'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Target, Plus, Trash2, Save, Loader2, CheckCircle2, AlertCircle,
  Package, Search, DollarSign, ToggleLeft, ToggleRight, Clock,
} from 'lucide-react'

interface Channel {
  id: number
  name: string
}

interface SourcingCondition {
  id: number
  name: string
  categories: string[]
  minPrice: number | null
  maxPrice: number | null
  minMarginRate: number | null
  includeKeywords: string[] | null
  excludeKeywords: string[] | null
  channelIds: number[] | null
  prioritySourcing: boolean
  maxDailyCount: number | null
  schedule: string | null
  isActive: boolean
}

const CATEGORY_OPTIONS = [
  '수산물', '축산물', '가공식품', '건강식품', '생활용품',
  '농산물', '과일', '간식/음료', '반찬/밀키트', '기타',
]

export default function SourcingConditionsPage() {
  const [conditions, setConditions] = useState<SourcingCondition[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showForm, setShowForm] = useState(false)

  // 폼 상태
  const [form, setForm] = useState({
    name: '',
    categories: [] as string[],
    minPrice: '',
    maxPrice: '',
    minMarginRate: '',
    includeKeywords: '',
    excludeKeywords: '',
    channelIds: [] as number[],
    prioritySourcing: false,
    maxDailyCount: '',
    schedule: '0 9,15 * * *',
  })

  const fetchData = useCallback(async () => {
    try {
      const [condRes, chRes] = await Promise.all([
        fetch('/api/sourcing-conditions'),
        fetch('/api/channel?limit=100&kind=WHOLESALE'),
      ])
      const condData = await condRes.json()
      const chData = await chRes.json()
      if (condData.success) setConditions(condData.data || [])
      if (chData.success) setChannels(chData.data || [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (!form.name.trim()) {
      setMessage({ type: 'error', text: '조건세트 이름을 입력하세요.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/sourcing-conditions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          categories: form.categories,
          minPrice: form.minPrice ? parseInt(form.minPrice) : null,
          maxPrice: form.maxPrice ? parseInt(form.maxPrice) : null,
          minMarginRate: form.minMarginRate ? parseFloat(form.minMarginRate) : null,
          includeKeywords: form.includeKeywords ? form.includeKeywords.split(',').map(s => s.trim()).filter(Boolean) : null,
          excludeKeywords: form.excludeKeywords ? form.excludeKeywords.split(',').map(s => s.trim()).filter(Boolean) : null,
          channelIds: form.channelIds.length > 0 ? form.channelIds : null,
          prioritySourcing: form.prioritySourcing,
          maxDailyCount: form.maxDailyCount ? parseInt(form.maxDailyCount) : null,
          schedule: form.schedule || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: '소싱조건이 저장되었습니다.' })
        setShowForm(false)
        setForm({ name: '', categories: [], minPrice: '', maxPrice: '', minMarginRate: '', includeKeywords: '', excludeKeywords: '', channelIds: [], prioritySourcing: false, maxDailyCount: '', schedule: '0 9,15 * * *' })
        fetchData()
      } else {
        setMessage({ type: 'error', text: data.error || '저장 실패' })
      }
    } catch { setMessage({ type: 'error', text: '네트워크 오류' }) }
    finally { setSaving(false); setTimeout(() => setMessage(null), 3000) }
  }

  const handleToggle = async (id: number, isActive: boolean) => {
    await fetch('/api/sourcing-conditions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !isActive }),
    })
    fetchData()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('이 소싱조건을 삭제하시겠습니까?')) return
    await fetch(`/api/sourcing-conditions?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><Target className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">소싱조건 설정</h1>
            <p className="text-sm text-gray-500">카테고리별 소싱조건을 설정하여 조건에 맞는 상품만 선별 수집합니다.</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} />
          조건 추가
        </button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* 조건 추가 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h3 className="text-lg font-semibold text-gray-900">새 소싱조건 만들기</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">조건세트 이름 *</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="예: 수산물 A급" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 선택</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map(cat => (
                <button key={cat} type="button"
                  onClick={() => setForm(p => ({ ...p, categories: p.categories.includes(cat) ? p.categories.filter(c => c !== cat) : [...p.categories, cat] }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${form.categories.includes(cat) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                >{cat}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최소 도매가</label>
              <input type="number" value={form.minPrice} onChange={e => setForm(p => ({ ...p, minPrice: e.target.value }))}
                placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최대 도매가</label>
              <input type="number" value={form.maxPrice} onChange={e => setForm(p => ({ ...p, maxPrice: e.target.value }))}
                placeholder="100000" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최소 마진율 (%)</label>
              <input type="number" value={form.minMarginRate} onChange={e => setForm(p => ({ ...p, minMarginRate: e.target.value }))}
                placeholder="30" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">포함 키워드 (쉼표 구분)</label>
              <input type="text" value={form.includeKeywords} onChange={e => setForm(p => ({ ...p, includeKeywords: e.target.value }))}
                placeholder="프리미엄, 자연산, 활" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제외 키워드 (쉼표 구분)</label>
              <input type="text" value={form.excludeKeywords} onChange={e => setForm(p => ({ ...p, excludeKeywords: e.target.value }))}
                placeholder="샘플, 테스트" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">소싱처(도매밴드) 선택</label>
            <div className="flex flex-wrap gap-2">
              {channels.map(ch => (
                <button key={ch.id} type="button"
                  onClick={() => setForm(p => ({ ...p, channelIds: p.channelIds.includes(ch.id) ? p.channelIds.filter(id => id !== ch.id) : [...p.channelIds, ch.id] }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.channelIds.includes(ch.id) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
                >{ch.name}</button>
              ))}
              {channels.length === 0 && <p className="text-xs text-gray-400">등록된 소싱처가 없습니다</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">일일 최대 수집</label>
              <input type="number" value={form.maxDailyCount} onChange={e => setForm(p => ({ ...p, maxDailyCount: e.target.value }))}
                placeholder="무제한" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수집 스케줄 (cron)</label>
              <input type="text" value={form.schedule} onChange={e => setForm(p => ({ ...p, schedule: e.target.value }))}
                placeholder="0 9,15 * * *" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <button type="button"
                onClick={() => setForm(p => ({ ...p, prioritySourcing: !p.prioritySourcing }))}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${form.prioritySourcing ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-white border-gray-200 text-gray-500'}`}
              >
                {form.prioritySourcing ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                주문장 우선소싱 {form.prioritySourcing ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">취소</button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              조건 저장
            </button>
          </div>
        </div>
      )}

      {/* 기존 조건 목록 */}
      <div className="space-y-3">
        {conditions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">등록된 소싱조건이 없습니다.</p>
            <p className="text-xs text-gray-400 mt-1">위 "조건 추가" 버튼을 눌러 소싱조건을 설정하세요.</p>
          </div>
        ) : (
          conditions.map(cond => (
            <div key={cond.id} className={`bg-white rounded-xl border shadow-sm p-5 ${cond.isActive ? 'border-blue-200' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{cond.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cond.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {cond.isActive ? '활성' : '비활성'}
                    </span>
                    {cond.prioritySourcing && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">우선소싱</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(cond.categories as string[])?.map(cat => (
                      <span key={cat} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{cat}</span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {(cond.minPrice || cond.maxPrice) && (
                      <span className="flex items-center gap-1"><DollarSign size={12} /> {cond.minPrice?.toLocaleString() || '0'}~{cond.maxPrice?.toLocaleString() || '∞'}원</span>
                    )}
                    {cond.minMarginRate && <span>마진 {cond.minMarginRate}%+</span>}
                    {cond.maxDailyCount && <span>일 {cond.maxDailyCount}건</span>}
                    {cond.schedule && <span className="flex items-center gap-1"><Clock size={12} /> {cond.schedule}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(cond.id, cond.isActive)}
                    className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                    {cond.isActive ? <ToggleRight size={20} className="text-blue-600" /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => handleDelete(cond.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
