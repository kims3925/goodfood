'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Edit,
  Trash2,
  AlertCircle,
  Save,
  X,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  Power,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface PricingPolicy {
  id: number
  userId: number
  name: string
  description: string | null
  content: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function PolicyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const toast = useToast()
  const policyId = parseInt(params.id as string)

  const [policy, setPolicy] = useState<PricingPolicy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 편집 모드 상태
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    isActive: true,
  })

  useEffect(() => {
    if (policyId) {
      loadPolicy()
    }
  }, [policyId])

  const loadPolicy = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/policy/${policyId}`)
      const data = await response.json()

      if (data.success) {
        setPolicy(data.data)
        setFormData({
          name: data.data.name,
          description: data.data.description || '',
          content: data.data.content,
          isActive: data.data.isActive,
        })
      } else {
        setError(data.error || '정책을 불러오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('정책 로드 실패:', err)
      setError('정책을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (policy) {
      setFormData({
        name: policy.name,
        description: policy.description || '',
        content: policy.content,
        isActive: policy.isActive,
      })
    }
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('정책 이름을 입력해주세요.')
      return
    }
    if (!formData.content.trim()) {
      toast.error('정책 내용을 입력해주세요.')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: policyId,
          ...formData,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setPolicy(data.data)
        setIsEditing(false)
        toast.success('정책이 저장되었습니다.')
      } else {
        toast.error(data.error || '정책 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('정책 저장 실패:', error)
      toast.error('정책 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (!policy) return
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!policy) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/policy?id=${policy.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('정책이 삭제되었습니다.')
        router.push('/policy/list')
      } else {
        toast.error('정책 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('정책 삭제 실패:', error)
      toast.error('정책 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
        <CheckCircle size={16} />
        활성
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
        <XCircle size={16} />
        비활성
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error || !policy) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="text-red-500" size={32} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">정책을 찾을 수 없습니다</h3>
                <p className="text-gray-600">{error}</p>
              </div>
              <Button variant="primary" onClick={() => router.push('/policy/list')}>
                정책 목록으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex items-center gap-4">
          <Link href="/policy/list">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              목록으로
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">정책 상세</h1>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {getStatusBadge(policy.isActive)}
            {isEditing ? (
              <>
                <Button variant="secondary" onClick={handleCancelEdit}>
                  <X size={16} />
                  취소
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                  <Save size={16} />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={handleStartEdit}>
                  <Edit size={16} />
                  수정
                </Button>
                <Button variant="danger" onClick={handleDelete}>
                  <Trash2 size={16} />
                  삭제
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 기본 정보 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 정책 설정 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* 카드 헤더 */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Settings size={18} className="text-blue-600" />
                    </div>
                    <span className="font-semibold text-slate-900">정책 설정</span>
                  </div>
                  {/* 활성화 토글 */}
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
                        formData.isActive
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-slate-400 text-white hover:bg-slate-500'
                      }`}
                    >
                      <Power size={14} />
                      {formData.isActive ? '활성' : '비활성'}
                    </button>
                  ) : (
                    getStatusBadge(policy.isActive)
                  )}
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">정책 이름</label>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="정책 이름"
                      maxLength={100}
                      className="!rounded-xl"
                    />
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-lg font-bold text-slate-900">{policy.name}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">설명</label>
                  {isEditing ? (
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="정책에 대한 간단한 설명"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-slate-600">{policy.description || '(설명 없음)'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 날짜 정보 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Calendar size={18} className="text-slate-600" />
                  </div>
                  <span className="font-semibold text-slate-900">날짜 정보</span>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    생성일
                  </span>
                  <span className="text-slate-900 font-medium text-sm">{formatDate(policy.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    수정일
                  </span>
                  <span className="text-slate-900 font-medium text-sm">{formatDate(policy.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 정책 내용 */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <FileText size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">정책 내용</span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      AI가 가격을 계산할 때 참조하는 정책 내용입니다.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {isEditing ? (
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="정책 내용을 입력하세요"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
                    rows={20}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-slate-800 font-mono text-sm bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed min-h-[400px]">
                    {policy.content}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="정책 삭제"
        message="이 정책을 삭제하시겠습니까? 삭제된 정책은 복구할 수 없습니다."
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
