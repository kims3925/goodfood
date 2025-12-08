'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function PolicyNewPage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    isActive: true,
  })

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        router.push('/policy/list')
      }
    } catch (error) {
      console.error('정책 저장 실패:', error)
    } finally {
      setIsSaving(false)
    }
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
              <h1 className="text-3xl font-bold text-gray-900">정책 추가</h1>
              <p className="text-gray-600 mt-1">새로운 가격 정책을 등록합니다.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/policy/list')}>
              취소
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              <Save size={16} />
              {isSaving ? '저장 중...' : '저장'}
            </Button>
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
                  <label className="text-sm font-medium text-gray-500 mb-2 block">
                    정책 이름 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="예: 가족도매방 정책"
                    maxLength={100}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">설명</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="정책에 대한 간단한 설명을 입력하세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">상태 설정</h2>
              </div>
              <div className="p-6 space-y-4 flex-1">
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">활성화 상태</label>
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
                  <p className="text-xs text-gray-500 mt-2">
                    활성화된 정책만 AI 가격 계산에 사용됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Policy Content Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                정책 내용 <span className="text-red-500">*</span>
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                AI가 가격을 계산할 때 참조하는 정책 내용입니다.
              </p>
            </div>
            <div className="p-6">
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="예: 원가 그대로, 수집가격 기준 구간별 마진 적용 등"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={15}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
