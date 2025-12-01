'use client'

/**
 * 디자인 A: 심플 모던 레이아웃
 * - 좌우 분할: 이미지 갤러리 좌측, 상품 정보 우측
 * - 깔끔한 카드 디자인
 * - 큰 이미지 미리보기
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Package, FileText, Trash2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
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

export default function ProductDetailTestA() {
  const router = useRouter()
  const params = useParams()
  const productId = parseInt(params.id as string)

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

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

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      COLLECTED: { label: '수집', color: 'bg-gray-100 text-gray-800 border-gray-300' },
      PUBLISHED: { label: '발행', color: 'bg-green-100 text-green-800 border-green-300' },
    }
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800 border-gray-300' }
    return (
      <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold border ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  const images = product?.post?.images || []

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

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
      {/* 상단 네비게이션 바 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/product/list')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
                {getStatusBadge(product.status)}
              </div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => setIsEditing(false)}>
                    <X size={16} /> 취소
                  </Button>
                  <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                    <Save size={16} /> {isSaving ? '저장 중...' : '저장'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setIsEditing(true)}>
                    <Edit size={16} /> 수정
                  </Button>
                  <Button variant="danger" onClick={handleDelete}>
                    <Trash2 size={16} /> 삭제
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 좌측: 이미지 갤러리 */}
          <div className="space-y-4">
            {/* 메인 이미지 */}
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-lg aspect-square">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[selectedImageIndex]?.imageUrl}
                    alt={`상품 이미지 ${selectedImageIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                      >
                        <ChevronRight size={24} />
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 text-white text-sm rounded-full">
                        {selectedImageIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <Package size={64} className="text-gray-300" />
                </div>
              )}
            </div>

            {/* 썸네일 */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImageIndex === index ? 'border-purple-500' : 'border-transparent'
                    }`}
                  >
                    <img src={image.imageUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 우측: 상품 정보 */}
          <div className="space-y-6">
            {/* 기본 정보 카드 */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-4 border-b">기본 정보</h2>

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
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                <>
                  {product.description && (
                    <p className="text-gray-600 mb-6 whitespace-pre-wrap">{product.description}</p>
                  )}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-gray-500">판매가</span>
                      <span className="text-2xl font-bold text-gray-900">{formatPrice(product.price)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-gray-500">도매가</span>
                      <span className="text-lg font-semibold text-gray-600">{formatPrice(product.wholesalePrice)}</span>
                    </div>
                    {product.categoryId && (
                      <div className="flex justify-between items-center py-3">
                        <span className="text-gray-500">카테고리</span>
                        <span className="text-gray-900">{product.categoryId}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 옵션 정보 */}
            {Object.keys(groupedOptions).length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-4 border-b">옵션</h2>
                <div className="space-y-4">
                  {Object.entries(groupedOptions).map(([groupName, values]) => (
                    <div key={groupName}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{groupName}</label>
                      <div className="flex flex-wrap gap-2">
                        {values.map((value, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm"
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
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">출처 게시물</h2>
                <Link
                  href={`/post/detail/${product.post.id}`}
                  className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
                >
                  <FileText size={14} /> 보기
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {product.post.wholesaleBand.name}
                </div>
                <span className="text-gray-600 text-sm truncate">{product.post.title}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 테스트 페이지 안내 */}
      <div className="fixed bottom-4 right-4 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
        디자인 A: 심플 모던 (좌우 분할)
      </div>
    </div>
  )
}
