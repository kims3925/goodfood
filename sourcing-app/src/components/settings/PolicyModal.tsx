'use client'

import { useState, useEffect } from 'react'
import { X, Save, FileText, Plus, Trash2 } from 'lucide-react'

// ── 정책 유형 (4가지) ─────────────────────────────────
type PolicyType = 'ZERO_MARGIN' | 'BRACKET_MARGIN' | 'BRACKET_MARGIN_EXTENDED' | 'SD_FOOD_SPECIAL'

interface BracketRow {
  id: string
  from: string
  to: string
  margin: string
  isDynamic: boolean
  dynBracketSize: string
  dynPerBracket: string
}

interface Channel {
  id: number
  name: string
  kind: string
}

interface PricingPolicy {
  id?: number
  channelId: number
  name: string
  description: string | null
  content: string
  isActive: boolean
  channel?: Channel
}

interface PolicyModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (policy: PricingPolicy) => Promise<void>
  policy?: PricingPolicy | null
  mode: 'create' | 'edit'
}

// ── 나은/SD푸드/VIP도매 공통 구간 (10+1행) ──
const NAUN_BRACKETS: BracketRow[] = [
  { id: '1', from: '1', to: '9900', margin: '4000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '2', from: '9901', to: '19900', margin: '5000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '3', from: '19901', to: '29900', margin: '6000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '4', from: '29901', to: '39900', margin: '7000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '5', from: '39901', to: '49900', margin: '8000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '6', from: '49901', to: '59900', margin: '9000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '7', from: '59901', to: '69900', margin: '10000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '8', from: '69901', to: '79900', margin: '11000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '9', from: '79901', to: '89900', margin: '12000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '10', from: '89901', to: '99900', margin: '13000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '11', from: '99901', to: '', margin: '13000', isDynamic: true, dynBracketSize: '1', dynPerBracket: '1000' },
]

// ── 가족도매방/초록이네 공통 구간 (3행) ──
const FAMILY_BRACKETS: BracketRow[] = [
  { id: '1', from: '1', to: '19900', margin: '0', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '2', from: '19901', to: '29900', margin: '1000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
  { id: '3', from: '29901', to: '40000', margin: '2000', isDynamic: false, dynBracketSize: '1', dynPerBracket: '1000' },
]

// ── 직렬화: 폼 → content 문자열 ──────────────────────
function serializeContent(
  policyType: PolicyType,
  brackets: BracketRow[],
  excludeAbove: string,
  shippingType: 'free' | 'included' | 'separate'
): string {
  if (policyType === 'ZERO_MARGIN') {
    return '판매가 그대로 사용 (마진 없음)\n배송비: ' + (shippingType === 'included' ? '포함' : '별도')
  }

  // SD_FOOD_SPECIAL: 특수 헤더 삽입
  const prefix = policyType === 'SD_FOOD_SPECIAL'
    ? '## SD푸드 특수 규칙\n공급가_출처: 댓글에서 추출\n본문판매가_표시시: 판매가 그대로 사용\n\n'
    : ''

  const lines: string[] = ['## 마진 구간표', '| 구간 | +마진 |', '|------|-------|']
  for (const row of brackets) {
    const from = row.from.replace(/,/g, '')
    const margin = row.margin.replace(/,/g, '')
    if (row.isDynamic) {
      const bs = row.dynBracketSize || '1'
      const pb = row.dynPerBracket.replace(/,/g, '') || '1000'
      lines.push(`| ${from}원 이상 | +${margin}원~ (${bs}만원 구간마다 +${pb}원 추가) |`)
    } else if (row.to) {
      lines.push(`| ${from}원 ~ ${row.to.replace(/,/g, '')}원 | +${margin}원 |`)
    }
  }
  if (excludeAbove) {
    lines.push('', `${excludeAbove.replace(/,/g, '')}원 이상 제외`)
  }
  const shipLabel = shippingType === 'included' ? '포함' : '별도'
  lines.push('배송비: ' + shipLabel)
  const baseNote = policyType === 'SD_FOOD_SPECIAL' ? '공급가' : '도매가'
  if (shippingType === 'separate') {
    lines.push(`기준가: ${baseNote} + 배송비 합산`)
  }
  return prefix + lines.join('\n')
}

// ── 역직렬화: content 문자열 → 폼 ──────────────────────
function deserializeContent(content: string): {
  policyType: PolicyType
  brackets: BracketRow[]
  excludeAbove: string
  shippingType: 'free' | 'included' | 'separate'
} {
  const isSdFood = content.includes('공급가_출처: 댓글에서 추출')

  // ⚠ SD푸드 content도 "판매가 그대로" 텍스트 포함 → isSdFood 체크 필수
  if (/판매가\s*그대로/.test(content) && !isSdFood) {
    return {
      policyType: 'ZERO_MARGIN',
      brackets: [],
      excludeAbove: '',
      shippingType: content.includes('포함') ? 'included' : 'separate',
    }
  }

  const brackets: BracketRow[] = []
  let idx = 0

  // 범위 행: | X원 ~ Y원 | +Z원 |
  const rangeRe = /\|\s*(\d[\d,]*)\s*원?\s*[~～]\s*(\d[\d,]*)\s*원?\s*\|\s*\+\s*(\d[\d,]*)\s*원/g
  let m
  while ((m = rangeRe.exec(content)) !== null) {
    brackets.push({
      id: String(idx++),
      from: m[1].replace(/,/g, ''),
      to: m[2].replace(/,/g, ''),
      margin: m[3].replace(/,/g, ''),
      isDynamic: false,
      dynBracketSize: '1',
      dynPerBracket: '1000',
    })
  }

  // 개방형 행: | X원 이상 | +Y원~ (...) |
  const openRe = /\|\s*(\d[\d,]*)\s*원?\s*이상\s*\|\s*\+\s*(\d[\d,]*)\s*원/g
  while ((m = openRe.exec(content)) !== null) {
    const tail = content.slice(m.index)
    const dynM = tail.match(/(\d+)\s*만원\s*구간마다\s*\+\s*(\d[\d,]*)\s*원\s*추가/)
    brackets.push({
      id: String(idx++),
      from: m[1].replace(/,/g, ''),
      to: '',
      margin: m[2].replace(/,/g, ''),
      isDynamic: true,
      dynBracketSize: dynM ? dynM[1] : '1',
      dynPerBracket: dynM ? dynM[2].replace(/,/g, '') : '1000',
    })
  }

  const exM = content.match(/(\d[\d,]*)\s*원?\s*이상\s*제외/)
  const excludeAbove = exM ? exM[1].replace(/,/g, '') : ''

  const policyType: PolicyType = isSdFood
    ? 'SD_FOOD_SPECIAL'
    : brackets.some(b => b.isDynamic)
      ? 'BRACKET_MARGIN_EXTENDED'
      : 'BRACKET_MARGIN'

  return {
    policyType,
    brackets,
    excludeAbove,
    shippingType: content.includes('포함') ? 'included' : 'separate',
  }
}

export default function PolicyModal({
  isOpen,
  onClose,
  onSave,
  policy,
  mode,
}: PolicyModalProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelId, setChannelId] = useState<number | ''>('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 구조화 폼 상태
  const [policyType, setPolicyType] = useState<PolicyType>('ZERO_MARGIN')
  const [brackets, setBrackets] = useState<BracketRow[]>([])
  const [excludeAbove, setExcludeAbove] = useState('')
  const [shippingType, setShippingType] = useState<'free' | 'included' | 'separate'>('separate')

  // 도매채널 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadWholesaleChannels()
    }
  }, [isOpen])

  const loadWholesaleChannels = async () => {
    setIsLoadingChannels(true)
    try {
      const response = await fetch('/api/channel?kind=WHOLESALE&limit=100')
      const data = await response.json()
      if (data.success) {
        setChannels(data.data || [])
      }
    } catch (error) {
      console.error('채널 목록 로드 실패:', error)
    } finally {
      setIsLoadingChannels(false)
    }
  }

  // 정책 데이터 로드 (수정 모드)
  useEffect(() => {
    if (policy && mode === 'edit') {
      setChannelId(policy.channelId)
      setName(policy.name)
      setDescription(policy.description || '')
      setIsActive(policy.isActive)
      // content 역직렬화
      const parsed = deserializeContent(policy.content || '')
      setPolicyType(parsed.policyType)
      setBrackets(parsed.brackets)
      setExcludeAbove(parsed.excludeAbove)
      setShippingType(parsed.shippingType)
    } else {
      setChannelId('')
      setName('')
      setDescription('')
      setIsActive(true)
      setPolicyType('ZERO_MARGIN')
      setBrackets([])
      setExcludeAbove('')
      setShippingType('separate')
    }
    setError(null)
  }, [policy, mode, isOpen])

  // 정책 유형 변경 → 기본 구간 자동 채움
  const handlePolicyTypeChange = (type: PolicyType) => {
    setPolicyType(type)
    if ((type === 'BRACKET_MARGIN_EXTENDED' || type === 'SD_FOOD_SPECIAL') && brackets.length === 0) {
      setBrackets([...NAUN_BRACKETS])
    } else if (type === 'BRACKET_MARGIN' && brackets.length === 0) {
      setBrackets([...FAMILY_BRACKETS])
    } else if (type === 'ZERO_MARGIN') {
      setBrackets([])
    }
  }

  // 구간 행 추가/삭제/수정
  const addBracket = (isDynamic = false) => {
    setBrackets(prev => [
      ...prev,
      {
        id: String(Date.now()),
        from: '',
        to: '',
        margin: '',
        isDynamic,
        dynBracketSize: '1',
        dynPerBracket: '1000',
      },
    ])
  }

  const removeBracket = (id: string) => {
    setBrackets(prev => prev.filter(b => b.id !== id))
  }

  const updateBracket = (id: string, key: keyof BracketRow, val: string | boolean) => {
    setBrackets(prev => prev.map(b => (b.id === id ? { ...b, [key]: val } : b)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!channelId) {
      setError('도매채널을 선택해주세요.')
      return
    }
    if (!name.trim()) {
      setError('정책 이름을 입력해주세요.')
      return
    }
    if (policyType !== 'ZERO_MARGIN' && brackets.length === 0) {
      setError('마진 구간을 1개 이상 추가해주세요.')
      return
    }
    for (const b of brackets) {
      if (!b.from || !b.margin) {
        setError('모든 구간의 시작값과 마진을 입력해주세요.')
        return
      }
      if (!b.isDynamic && !b.to) {
        setError('범위 구간의 끝값을 입력해주세요.')
        return
      }
    }

    const content = serializeContent(policyType, brackets, excludeAbove, shippingType)

    setIsSaving(true)
    try {
      await onSave({
        id: policy?.id,
        channelId: channelId as number,
        name: name.trim(),
        description: description.trim() || null,
        content,
        isActive,
      })
      onClose()
    } catch (err) {
      setError('저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText size={20} className="text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === 'create' ? '새 정책 추가' : '정책 수정'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(95vh-140px)]">
          {/* 도매채널 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              도매채널 <span className="text-red-500">*</span>
            </label>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value ? parseInt(e.target.value) : '')}
              disabled={isLoadingChannels}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">
                {isLoadingChannels ? '채널 로딩 중...' : '도매채널을 선택하세요'}
              </option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </div>

          {/* 정책 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              정책 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 기본 마진 정책"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              설명 <span className="text-gray-400">(선택)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 정책에 대한 간단한 설명"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 정책 유형 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              정책 유형 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['ZERO_MARGIN', '① 마진 없음', '킹도매방'],
                ['BRACKET_MARGIN', '② 구간 마진', '가족도매방 / 초록이네'],
                ['BRACKET_MARGIN_EXTENDED', '③ 확장 구간', '나은 / VIP도매'],
                ['SD_FOOD_SPECIAL', '④ SD푸드 특수', '댓글 공급가 추출'],
              ] as const).map(([type, label, sub]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handlePolicyTypeChange(type as PolicyType)}
                  className={`p-3 rounded-lg border-2 text-left text-xs font-medium transition-colors ${
                    policyType === type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold">{label}</div>
                  <div className="text-gray-400 text-[10px] mt-0.5">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 마진 구간 (ZERO_MARGIN 이외) */}
          {policyType !== 'ZERO_MARGIN' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">마진 구간</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => addBracket(false)}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                  >
                    <Plus size={12} /> 범위 구간
                  </button>
                  {(policyType === 'BRACKET_MARGIN_EXTENDED' || policyType === 'SD_FOOD_SPECIAL') && (
                    <button
                      type="button"
                      onClick={() => addBracket(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded hover:bg-orange-200"
                    >
                      <Plus size={12} /> 동적 구간
                    </button>
                  )}
                </div>
              </div>

              {/* 구간 헤더 */}
              <div className="grid grid-cols-12 gap-1 text-xs text-gray-500 font-medium">
                <div className="col-span-3">시작(원)</div>
                <div className="col-span-3">끝(원)</div>
                <div className="col-span-3">마진(원)</div>
                <div className="col-span-2">동적설정</div>
                <div className="col-span-1" />
              </div>

              {/* 구간 행 */}
              {brackets.map((row) => (
                <div key={row.id} className="grid grid-cols-12 gap-1 items-center">
                  <input
                    className="col-span-3 input-sm"
                    placeholder="1"
                    value={row.from}
                    onChange={(e) => updateBracket(row.id, 'from', e.target.value)}
                  />
                  <input
                    className="col-span-3 input-sm"
                    disabled={row.isDynamic}
                    placeholder={row.isDynamic ? '(이상)' : '19900'}
                    value={row.isDynamic ? '(이상)' : row.to}
                    onChange={(e) => updateBracket(row.id, 'to', e.target.value)}
                  />
                  <input
                    className="col-span-3 input-sm"
                    placeholder="4000"
                    value={row.margin}
                    onChange={(e) => updateBracket(row.id, 'margin', e.target.value)}
                  />
                  {row.isDynamic ? (
                    <div className="col-span-2 flex gap-1">
                      <input
                        className="w-full input-sm"
                        placeholder="만원"
                        title="N만원마다"
                        value={row.dynBracketSize}
                        onChange={(e) => updateBracket(row.id, 'dynBracketSize', e.target.value)}
                      />
                      <input
                        className="w-full input-sm"
                        placeholder="+원"
                        title="+M원추가"
                        value={row.dynPerBracket}
                        onChange={(e) => updateBracket(row.id, 'dynPerBracket', e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="col-span-2" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeBracket(row.id)}
                    className="col-span-1 p-1 text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* 소싱 제외 */}
              <div className="flex items-center gap-2 mt-3">
                <label className="text-sm text-gray-600 whitespace-nowrap">소싱 제외:</label>
                <input
                  className="input-sm w-32"
                  placeholder="40001"
                  value={excludeAbove}
                  onChange={(e) => setExcludeAbove(e.target.value)}
                />
                <span className="text-xs text-gray-500">원 이상 제외 (비워두면 없음)</span>
              </div>
            </div>
          )}

          {/* 배송비 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">배송비 유형</label>
            <div className="flex gap-3">
              {(['free', 'included', 'separate'] as const).map((s) => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="shippingType"
                    value={s}
                    checked={shippingType === s}
                    onChange={() => setShippingType(s)}
                  />
                  <span className="text-sm">
                    {s === 'free' ? '무료배송' : s === 'included' ? '배송비 포함' : '배송비 별도'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 저장 전 미리보기 */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-1">저장될 content 미리보기</p>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
              {serializeContent(policyType, brackets, excludeAbove, shippingType)}
            </pre>
          </div>

          {/* 활성화 상태 */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
            <span className="text-sm text-gray-700">
              {isActive ? '활성화됨' : '비활성화됨'}
            </span>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {mode === 'create' ? '추가' : '저장'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
