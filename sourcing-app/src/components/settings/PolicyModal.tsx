'use client'

import { useState, useEffect } from 'react'
import { X, Save, FileText } from 'lucide-react'

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

export default function PolicyModal({
  isOpen,
  onClose,
  onSave,
  policy,
  mode
}: PolicyModalProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelId, setChannelId] = useState<number | ''>('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    if (policy && mode === 'edit') {
      setChannelId(policy.channelId)
      setName(policy.name)
      setDescription(policy.description || '')
      setContent(policy.content)
      setIsActive(policy.isActive)
    } else {
      setChannelId('')
      setName('')
      setDescription('')
      setContent('')
      setIsActive(true)
    }
    setError(null)
  }, [policy, mode, isOpen])

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
    if (!content.trim()) {
      setError('정책 내용을 입력해주세요.')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        id: policy?.id,
        channelId: channelId as number,
        name: name.trim(),
        description: description.trim() || null,
        content: content.trim(),
        isActive
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
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
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
            {channels.length === 0 && !isLoadingChannels && (
              <p className="text-xs text-amber-600 mt-1">
                등록된 도매채널이 없습니다. 먼저 도매채널을 등록해주세요.
              </p>
            )}
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

          {/* 정책 내용 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              정책 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="AI가 참조할 가격 정책 내용을 입력하세요.&#10;&#10;예시:&#10;# 마진율&#10;- 5만원 이하: 50% 마진&#10;- 5만원~10만원: 40% 마진&#10;- 10만원 이상: 30% 마진&#10;&#10;# 배송비 처리&#10;- 배송비는 소매 판매가에 포함됩니다&#10;- 배송비가 별도로 표시된 경우, 해당 금액을 도매가에 합산한 후 마진을 적용합니다&#10;- 예: 도매가 10,000원 + 배송비 3,000원 = 13,000원 → 마진 적용"
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              이 내용은 프롬프트의 {'{policySection}'} 변수에 삽입됩니다.
            </p>
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
