'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  ScrollText,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

export default function TermsPolicyNewPage() {
  const router = useRouter()
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isMainVersion, setIsMainVersion] = useState(false)
  const [nextVersion, setNextVersion] = useState('0.1')

  const [formData, setFormData] = useState({
    name: '',
    content: '',
  })

  const fetchNextVersion = useCallback(async () => {
    try {
      const response = await fetch('/api/policy/terms?limit=1')
      const data = await response.json()

      if (data.success && data.data.length > 0) {
        const latest = data.data[0]
        if (isMainVersion) {
          setNextVersion(`${latest.main + 1}.0`)
        } else {
          setNextVersion(`${latest.main}.${latest.sub + 1}`)
        }
      } else {
        setNextVersion('0.1')
      }
    } catch (error) {
      console.error('버전 조회 실패:', error)
      setNextVersion('0.1')
    }
  }, [isMainVersion])

  useEffect(() => {
    fetchNextVersion()
  }, [fetchNextVersion])

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('이름과 내용을 입력해주세요.')
      return
    }

    try {
      setIsSaving(true)
      const response = await fetch('/api/policy/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          isMainVersion,
        }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success('이용약관이 생성되었습니다.')
        router.push('/shop/policy/terms')
      } else {
        toast.error(data.error || '생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('이용약관 생성 실패:', error)
      toast.error('생성에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/shop/policy/terms')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            목록으로
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ScrollText size={24} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">새 이용약관</h1>
                <p className="text-gray-600">
                  새 이용약관을 작성합니다.
                </p>
              </div>
            </div>
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

        {/* 내용 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* 버전 정보 */}
          <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">버전</label>
              <Input
                value={`v${nextVersion}`}
                readOnly
                className="bg-gray-50"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMainVersion}
                  onChange={(e) => setIsMainVersion(e.target.checked)}
                  className="w-4 h-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  메인 버전 업데이트
                </span>
              </label>
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
              placeholder="이용약관 이름을 입력하세요"
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
              placeholder="이용약관 내용을 입력하세요"
              rows={20}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
