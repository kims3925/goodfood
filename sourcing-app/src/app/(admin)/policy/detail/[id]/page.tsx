'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Trash2, AlertCircle, Save, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'

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
  const policyId = parseInt(params.id as string)

  const [policy, setPolicy] = useState<PricingPolicy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      return
    }
    if (!formData.content.trim()) {
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
      }
    } catch (error) {
      console.error('정책 저장 실패:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!policy) return
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/policy?id=${policy.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        router.push('/policy/list')
      }
    } catch (error) {
      console.error('정책 삭제 실패:', error)
    }
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
        활성
      </span>
    ) : (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
        비활성
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR')
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-red-500" size={48} />
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
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/policy/list')}>
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">정책 상세</h1>
              <p className="text-gray-600 mt-1">정책 정보를 확인하고 수정할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex gap-2">
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

        <div className="space-y-6">
          {/* Row 1: 기본정보 + 상태관리 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Basic Info Card */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">기본 정보</h2>
              </div>
              <div className="p-6 space-y-6 flex-1">
                {/* Name */}
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">정책 이름</label>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="정책 이름"
                      maxLength={100}
                    />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">{policy.name}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">설명</label>
                  {isEditing ? (
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="정책에 대한 간단한 설명"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  ) : (
                    <p className="text-gray-600">{policy.description || '-'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">상태 관리</h2>
              </div>
              <div className="p-6 space-y-4 flex-1">
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">현재 상태</label>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="isActive" className="text-sm text-gray-700">
                        활성화
                      </label>
                    </div>
                  ) : (
                    getStatusBadge(policy.isActive)
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">생성일</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(policy.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">수정일</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(policy.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Policy Content Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">정책 내용</h2>
              <p className="text-sm text-gray-500 mt-1">
                AI가 가격을 계산할 때 참조하는 정책 내용입니다.
              </p>
            </div>
            <div className="p-6">
              {isEditing ? (
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="정책 내용을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={15}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-gray-800 font-mono text-sm bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {policy.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
