'use client'

/**
 * 디자인 B: 대시보드 스타일
 * - 그라데이션 헤더
 * - 통계 카드 강조
 * - 넓은 이미지 갤러리
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Package, FileText, Trash2, AlertCircle, Calendar, Tag, Layers } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Link from 'next/link'

interface Product {
  id: number
  postId: number
  name: string
  description: string | null
  status: 'COLLECTED' | 'PUBLISHED'
  thumbnailUrl: string | null
  price: number | null
  wholesalePrice: number | null
  categoryId: string | null
  currency: string
  createdAt: string
  updatedAt: string
  post: {
    id: number
    title: string
    content: string
    wholesaleBand: {
      name: string
      bandKey: string
      coverUrl: string | null
    }
    images: Array<{
      id: number
      imageUrl: string
      name?: string
      sortOrder: number
    }>
  }
  options: Array<{
    id: number
    groupName: string
    value: string
    sortOrder: number
  }>
  variants: Array<{
    id: number
    sku: string | null
    optionSummary: string | null
    price: number
    wholesalePrice: number | null
    stock: number
  }>
}

export default function ProductDetailTestB() {
  const router = useRouter()
  const params = useParams()
  const productId = parseInt(params.id as string)

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 편집 모드 상태
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    price: '',
    wholesalePrice: '',
  })

  useEffect(() => {
    if (productId) {
      loadProduct()
    }
  }, [productId])

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/product/${productId}`)
      const data = await response.json()

      if (data.success) {
        setProduct(data.data)
        setFormData({
          name: data.data.name || '',
          description: data.data.description || '',
          categoryId: data.data.categoryId || '',
          price: data.data.price?.toString() || '',
          wholesalePrice: data.data.wholesalePrice?.toString() || '',
        })
      } else {
        setError(data.error || '상품을 불러오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('상품 로드 실패:', err)
      setError('상품을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!product || !formData.name.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          categoryId: formData.categoryId.trim() || null,
          price: formData.price ? parseInt(formData.price) : null,
          wholesalePrice: formData.wholesalePrice ? parseInt(formData.wholesalePrice) : null,
        }),
      })

      const data = await response.json()
      if (data.success) {
        loadProduct()
        setIsEditing(false)
      }
    } catch (error) {
      console.error('상품 저장 실패:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!product) return
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/product?id=${product.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        router.push('/product/list')
      }
    } catch (error) {
      console.error('상품 삭제 실패:', error)
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const images = product?.post?.images || []

  // Group options by groupName
  const groupedOptions = (product?.options || []).reduce((acc, option) => {
    if (!acc[option.groupName]) {
      acc[option.groupName] = []
    }
    acc[option.groupName].push(option.value)
    return acc
  }, {} as Record<string, string[]>)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h3 className="text-lg font-semibold mb-2">상품을 찾을 수 없습니다</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button variant="primary" onClick={() => router.push('/product/list')}>
            상품 목록으로 돌아가기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 그라데이션 헤더 */}
      <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/product/list')}
                className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-white">{product.name}</h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    product.status === 'PUBLISHED'
                      ? 'bg-green-400 text-green-900'
                      : 'bg-white/30 text-white'
                  }`}>
                    {product.status === 'PUBLISHED' ? '발행' : '수집'}
                  </span>
                </div>
                <p className="text-purple-100 text-sm">
                  {product.post.wholesaleBand.name} • 등록일 {formatDate(product.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => setIsEditing(false)} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                    <X size={16} /> 취소
                  </Button>
                  <Button variant="primary" onClick={handleSave} disabled={isSaving} className="bg-white text-purple-600 hover:bg-gray-100">
                    <Save size={16} /> {isSaving ? '저장 중...' : '저장'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setIsEditing(true)} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                    <Edit size={16} /> 수정
                  </Button>
                  <Button variant="danger" onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                    <Trash2 size={16} /> 삭제
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 통계 카드들 */}
        <div className="max-w-7xl mx-auto px-6 pb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
              <div className="text-purple-200 text-sm mb-1">판매가</div>
              <div className="text-2xl font-bold">{formatPrice(product.price)}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
              <div className="text-purple-200 text-sm mb-1">도매가</div>
              <div className="text-2xl font-bold">{formatPrice(product.wholesalePrice)}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
              <div className="text-purple-200 text-sm mb-1">이미지</div>
              <div className="text-2xl font-bold">{images.length}개</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
              <div className="text-purple-200 text-sm mb-1">옵션</div>
              <div className="text-2xl font-bold">{Object.keys(groupedOptions).length}개</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* 이미지 갤러리 - 가로 스크롤 */}
        {images.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Layers size={20} className="text-purple-500" />
                상품 이미지
                <span className="text-sm font-normal text-gray-400 ml-2">{images.length}개</span>
              </h2>
            </div>
            <div className="p-4">
              <div className="flex gap-4 overflow-x-auto pb-4">
                {images.map((image, index) => (
                  <div key={image.id} className="relative flex-shrink-0">
                    {index === 0 && (
                      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-purple-600 text-white text-xs rounded-full font-medium">
                        대표
                      </div>
                    )}
                    <img
                      src={image.imageUrl}
                      alt={`상품 이미지 ${index + 1}`}
                      className="w-48 h-48 object-cover rounded-xl border border-gray-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 상품 정보 */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Tag size={20} className="text-purple-500" />
                상품 정보
              </h2>
            </div>
            <div className="p-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">상품명</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={6}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                      <Input
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">판매가</label>
                      <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">도매가</label>
                      <Input
                        type="number"
                        value={formData.wholesalePrice}
                        onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {product.description && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">상품 설명</h3>
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{product.description}</p>
                    </div>
                  )}
                  {product.categoryId && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">카테고리</h3>
                      <span className="inline-flex items-center px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">
                        {product.categoryId}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 사이드바 */}
          <div className="space-y-6">
            {/* 옵션 정보 */}
            {Object.keys(groupedOptions).length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm">
                <div className="p-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">옵션</h2>
                </div>
                <div className="p-4 space-y-4">
                  {Object.entries(groupedOptions).map(([groupName, values]) => (
                    <div key={groupName}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{groupName}</label>
                      <div className="flex flex-wrap gap-2">
                        {values.map((value, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm"
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 출처 정보 */}
            <div className="bg-white rounded-2xl shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">출처</h2>
                <Link
                  href={`/post/detail/${product.post.id}`}
                  className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
                >
                  <FileText size={14} /> 게시물 보기
                </Link>
              </div>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {product.post.images[0] && (
                    <img
                      src={product.post.images[0].imageUrl}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-purple-600 mb-1">
                      {product.post.wholesaleBand.name}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{product.post.title}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 메타데이터 */}
            <div className="bg-white rounded-2xl shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar size={18} className="text-gray-400" />
                  이력
                </h2>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">생성일</span>
                  <span className="text-gray-700">{formatDate(product.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">수정일</span>
                  <span className="text-gray-700">{formatDate(product.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 테스트 페이지 안내 */}
      <div className="fixed bottom-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
        디자인 B: 대시보드 스타일
      </div>
    </div>
  )
}
