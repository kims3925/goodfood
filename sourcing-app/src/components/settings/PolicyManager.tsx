'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, CheckCircle, XCircle, FileText, AlertCircle } from 'lucide-react'
import PolicyModal from './PolicyModal'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Channel {
  id: number
  name: string
  kind: string
}

interface PolicyTarget {
  retailChannelId: number
  applyMode: 'INHERIT' | 'ZERO_MARGIN' | 'CUSTOM'
  customContent?: string | null
  retailChannel?: Channel
}

interface PricingPolicy {
  id: number
  channelId: number
  name: string
  description: string | null
  content: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  channel?: Channel
  // 경영밴드 이원화 정책 (2026-05-28): 적용 대상 소매채널
  targets?: PolicyTarget[]
}

interface PolicyManagerProps {
  onToast: (type: 'success' | 'error', message: string) => void
}

export default function PolicyManager({ onToast }: PolicyManagerProps) {
  const [policies, setPolicies] = useState<PricingPolicy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedPolicy, setSelectedPolicy] = useState<PricingPolicy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PricingPolicy | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadPolicies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadPolicies = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/policy?limit=100')
      const data = await response.json()

      if (data.success) {
        setPolicies(data.data || [])
      }
    } catch (error) {
      console.error('정책 목록 조회 실패:', error)
      onToast('error', '정책 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedPolicy(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEdit = (policy: PricingPolicy) => {
    setSelectedPolicy(policy)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDelete = (policy: PricingPolicy) => {
    setDeleteTarget(policy)
  }

  const handleSave = async (policyData: {
    id?: number
    channelId: number
    name: string
    description: string | null
    content: string
    isActive: boolean
    tierRules?: unknown
    targets?: PolicyTarget[]
  }) => {
    try {
      const isEdit = modalMode === 'edit' && policyData.id

      const response = await fetch('/api/policy', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyData)
      })

      const data = await response.json()

      if (data.success) {
        onToast('success', isEdit ? '정책이 수정되었습니다.' : '정책이 추가되었습니다.')
        loadPolicies()
      } else {
        throw new Error(data.error || '저장 실패')
      }
    } catch (error) {
      console.error('정책 저장 실패:', error)
      throw error
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/policy?id=${deleteTarget.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (data.success) {
        onToast('success', '정책이 삭제되었습니다.')
        loadPolicies()
      } else {
        onToast('error', '정책 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('정책 삭제 실패:', error)
      onToast('error', '정책 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...'
    }
    return text
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">가격 정책이란?</p>
            <p className="text-amber-700">
              AI가 상품을 변환할 때 참조하는 가격 책정 규칙입니다.
              프롬프트의 <code className="bg-amber-100 px-1 rounded">{'{policySection}'}</code> 변수에 삽입됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">총 {policies.length}개의 정책</span>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} />
          새 정책 추가
        </button>
      </div>

      {/* Policy Cards */}
      {policies.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 정책이 없습니다</h3>
          <p className="text-gray-500 mb-6">새 가격 정책을 추가하여 AI 변환에 활용하세요.</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={16} />
            첫 번째 정책 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${policy.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <FileText size={16} className={policy.isActive ? 'text-green-600' : 'text-gray-500'} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{policy.name}</h3>
                    {policy.channel && (
                      <p className="text-xs text-blue-600 font-medium">{policy.channel.name}</p>
                    )}
                    {policy.description && (
                      <p className="text-xs text-gray-500">{policy.description}</p>
                    )}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  policy.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {policy.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  {policy.isActive ? '활성' : '비활성'}
                </span>
              </div>

              {/* Content Preview */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="text-sm text-gray-600 font-mono whitespace-pre-wrap">
                  {truncateText(policy.content)}
                </p>
              </div>

              {/* 경영밴드 이원화 정책 — 적용 대상 소매채널 표시 */}
              <div className="mb-4">
                <p className="text-[11px] text-gray-500 mb-1.5">적용 대상</p>
                {(!policy.targets || policy.targets.length === 0) ? (
                  <span className="inline-block px-2 py-0.5 text-[11px] bg-gray-100 text-gray-600 rounded">
                    모든 소매밴드 (INHERIT 기본)
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {policy.targets.map((t) => {
                      const label = t.retailChannel?.name ?? `채널 ${t.retailChannelId}`
                      const cls =
                        t.applyMode === 'ZERO_MARGIN'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : t.applyMode === 'CUSTOM'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      const modeShort =
                        t.applyMode === 'ZERO_MARGIN' ? '마진0'
                        : t.applyMode === 'CUSTOM' ? 'CUSTOM'
                        : 'INHERIT'
                      return (
                        <span
                          key={t.retailChannelId}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded ${cls}`}
                          title={`${label} — ${t.applyMode}`}
                        >
                          <span className="truncate max-w-[120px]">{label}</span>
                          <span className="opacity-75">· {modeShort}</span>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => handleEdit(policy)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 size={14} />
                  수정
                </button>
                <button
                  onClick={() => handleDelete(policy)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Policy Modal */}
      <PolicyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        policy={selectedPolicy}
        mode={modalMode}
      />

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="정책 삭제"
        message={`"${deleteTarget?.name}" 정책을 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
