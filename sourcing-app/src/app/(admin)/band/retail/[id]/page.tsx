'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Trash2, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'

interface Band {
  id: number
  userId: number
  apiConfigId: number
  bandKey: string
  name: string
  coverUrl: string | null
  orderUrl: string | null
  isActive: boolean
  createdAt: string
  apiConfig: {
    platform: string
  }
  user: {
    email: string
    name: string | null
  }
}

export default function RetailBandDetailPage() {
  const params = useParams()
  const router = useRouter()
  const bandId = params.id as string

  const [band, setBand] = useState<Band | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    orderUrl: '',
    isActive: true,
  })

  // 초기 데이터 (변경 감지용)
  const [initialData, setInitialData] = useState({
    name: '',
    orderUrl: '',
    isActive: true,
  })

  // 변경사항 여부
  const hasChanges =
    formData.name !== initialData.name ||
    formData.orderUrl !== initialData.orderUrl ||
    formData.isActive !== initialData.isActive

  useEffect(() => {
    loadBand()
  }, [bandId])

  const loadBand = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/band/retail/${bandId}`)
      const data = await response.json()

      if (data.success) {
        setBand(data.data)
        const initial = {
          name: data.data.name,
          orderUrl: data.data.orderUrl || '',
          isActive: data.data.isActive,
        }
        setFormData(initial)
        setInitialData(initial)
      } else {
        alert(data.error || '밴드를 불러오는데 실패했습니다.')
        router.push('/band/retail')
      }
    } catch (error) {
      console.error('밴드 조회 실패:', error)
      router.push('/band/retail')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!hasChanges) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/band/retail/${bandId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setInitialData(formData)
        setBand(data.data)
      } else {
        alert(data.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('저장 실패:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 이 밴드를 삭제하시겠습니까?')) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/band/retail/${bandId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        router.push('/band/retail')
      } else {
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!band) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/band/retail')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>목록으로</span>
          </button>

          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
              삭제
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              저장
            </Button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <Card className="p-6">
          <div className="space-y-6">
            {/* 커버 이미지 */}
            <div className="flex justify-center">
              {band.coverUrl ? (
                <img
                  src={band.coverUrl}
                  alt={band.name}
                  className="w-48 h-48 rounded-lg object-cover"
                />
              ) : (
                <div className="w-48 h-48 rounded-lg bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">No Image</span>
                </div>
              )}
            </div>

            {/* 밴드명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                밴드명 *
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="밴드 이름을 입력하세요"
              />
            </div>

            {/* 주문서 URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                주문서 URL
              </label>
              <Input
                type="text"
                value={formData.orderUrl}
                onChange={(e) => setFormData({ ...formData, orderUrl: e.target.value })}
                placeholder="주문서 URL을 입력하세요 (예: https://example.com/order)"
              />
              <p className="mt-1 text-sm text-gray-500">
                이 밴드에서 사용할 주문서 페이지 URL을 입력하세요.
              </p>
            </div>

            {/* 상태 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상태
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">
                  {formData.isActive ? '활성' : '비활성'}
                </span>
              </label>
            </div>

            {/* 읽기 전용 정보 */}
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    플랫폼
                  </label>
                  <p className="text-gray-900">{band.apiConfig.platform}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    밴드 키
                  </label>
                  <p className="text-gray-900 text-sm font-mono">{band.bandKey}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    등록일
                  </label>
                  <p className="text-gray-900">
                    {new Date(band.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
