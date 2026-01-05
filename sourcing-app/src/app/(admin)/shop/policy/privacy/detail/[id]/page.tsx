'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Trash2,
  Lock,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface PrivacyPolicy {
  id: number
  name: string
  content: string
  main: number
  sub: number
  createdAt: string
  updatedAt: string
}

export default function PrivacyPolicyDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    content: '',
  })
  const [policy, setPolicy] = useState<PrivacyPolicy | null>(null)

  const loadPolicy = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/policy/privacy/${id}`)
      const data = await response.json()

      if (data.success) {
        setPolicy(data.data)
        setFormData({
          name: data.data.name,
          content: data.data.content,
        })
      } else {
        toast.error(data.error || '개인정보처리방침을 불러오는데 실패했습니다.')
        router.push('/shop/policy/privacy')
      }
    } catch (error) {
      console.error('개인정보처리방침 조회 실패:', error)
      toast.error('개인정보처리방침을 불러오는데 실패했습니다.')
      router.push('/shop/policy/privacy')
    } finally {
      setIsLoading(false)
    }
  }, [id, router, toast])

  useEffect(() => {
    loadPolicy()
  }, [loadPolicy])

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('이름과 내용을 입력해주세요.')
      return
    }

    try {
      setIsSaving(true)
      const response = await fetch(`/api/policy/privacy/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await response.json()

      if (data.success) {
        toast.success('개인정보처리방침이 수정되었습니다.')
        loadPolicy()
      } else {
        toast.error(data.error || '수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('개인정보처리방침 수정 실패:', error)
      toast.error('수정에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      const response = await fetch(`/api/policy/privacy/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        toast.success('개인정보처리방침이 삭제되었습니다.')
        router.push('/shop/policy/privacy')
      } else {
        toast.error(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('개인정보처리방침 삭제 실패:', error)
      toast.error('삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  const formatVersion = (main: number, sub: number) => {
    return `${main}.${sub}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!policy) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/shop/policy/privacy')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            목록으로
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Lock size={24} className="text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">개인정보처리방침 상세</h1>
                <p className="text-gray-600">
                  버전 {formatVersion(policy.main, policy.sub)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={16} />
                삭제
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save size={16} />
                {isSaving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>

        {/* 내용 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* 메타 정보 */}
          <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">버전</label>
              <Input
                value={`v${formatVersion(policy.main, policy.sub)}`}
                readOnly
                className="bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">생성일</label>
              <Input
                value={formatDate(policy.createdAt)}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>

          {/* 이름 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이름 <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="개인정보처리방침 이름을 입력하세요"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="개인정보처리방침 내용을 입력하세요"
              rows={20}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
            />
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="개인정보처리방침 삭제"
        message="이 개인정보처리방침을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
