'use client'

/**
 * 디자인 C: 탭 기반 레이아웃
 * - 정보/이미지/옵션/출처를 탭으로 분리
 * - 컴팩트한 헤더
 * - 넓은 콘텐츠 영역
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Package, FileText, Trash2, AlertCircle, Image, Settings, Info, Link2 } from 'lucide-react'
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

type TabType = 'info' | 'images' | 'options' | 'source'

export default function ProductDetailTestC() {
  const router = useRouter()
  const params = useParams()
  const productId = parseInt(params.id as string)

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('info')

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
    return new Date(dateString).toLocaleString('ko-KR')
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

  const tabs = [
    { id: 'info' as TabType, label: '기본 정보', icon: Info },
    { id: 'images' as TabType, label: '이미지', icon: Image, count: images.length },
    { id: 'options' as TabType, label: '옵션', icon: Settings, count: Object.keys(groupedOptions).length },
    { id: 'source' as TabType, label: '출처', icon: Link2 },
  ]

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
    <div className="min-h-screen bg-gray-50">
      {/* 컴팩트 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/product/list')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-4">
                {product.thumbnailUrl ? (
                  <img
                    src={product.thumbnailUrl}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Package size={24} className="text-gray-400" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-gray-900">{product.name}</h1>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      product.status === 'PUBLISHED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {product.status === 'PUBLISHED' ? '발행' : '수집'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{product.post.wholesaleBand.name}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                    <X size={14} /> 취소
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                    <Save size={14} /> {isSaving ? '저장 중...' : '저장'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit size={14} /> 수정
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDelete}>
                    <Trash2 size={14} /> 삭제
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      activeTab === tab.id
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 기본 정보 탭 */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6">
              {isEditing ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">상품명</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="max-w-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={8}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-6 max-w-2xl">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
                      <Input
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">판매가</label>
                      <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">도매가</label>
                      <Input
                        type="number"
                        value={formData.wholesalePrice}
                        onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* 가격 정보 */}
                  <div className="grid grid-cols-3 gap-8">
                    <div className="p-4 bg-purple-50 rounded-xl">
                      <div className="text-sm text-purple-600 font-medium mb-1">판매가</div>
                      <div className="text-2xl font-bold text-purple-900">{formatPrice(product.price)}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-sm text-gray-600 font-medium mb-1">도매가</div>
                      <div className="text-2xl font-bold text-gray-900">{formatPrice(product.wholesalePrice)}</div>
                    </div>
                    {product.categoryId && (
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="text-sm text-gray-600 font-medium mb-1">카테고리</div>
                        <div className="text-lg font-semibold text-gray-900">{product.categoryId}</div>
                      </div>
                    )}
                  </div>

                  {/* 설명 */}
                  {product.description && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-3">상품 설명</h3>
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{product.description}</p>
                      </div>
                    </div>
                  )}

                  {/* 메타데이터 */}
                  <div className="pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">생성일:</span>
                        <span className="ml-2 text-gray-700">{formatDate(product.createdAt)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">수정일:</span>
                        <span className="ml-2 text-gray-700">{formatDate(product.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 이미지 탭 */}
        {activeTab === 'images' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6">
              {images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {images.map((image, index) => (
                    <div key={image.id} className="relative group">
                      {index === 0 && (
                        <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-purple-600 text-white text-xs rounded-full font-medium">
                          대표
                        </div>
                      )}
                      <img
                        src={image.imageUrl}
                        alt={`상품 이미지 ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-xl border border-gray-200 group-hover:border-purple-300 transition-colors"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-colors" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Image size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">등록된 이미지가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 옵션 탭 */}
        {activeTab === 'options' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6">
              {Object.keys(groupedOptions).length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(groupedOptions).map(([groupName, values]) => (
                    <div key={groupName} className="p-4 bg-gray-50 rounded-xl">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">{groupName}</h3>
                      <div className="flex flex-wrap gap-2">
                        {values.map((value, idx) => (
                          <span
                            key={idx}
                            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm hover:border-purple-300 transition-colors"
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Settings size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">등록된 옵션이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 출처 탭 */}
        {activeTab === 'source' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="flex items-start gap-6">
                {product.post.images[0] && (
                  <img
                    src={product.post.images[0].imageUrl}
                    alt=""
                    className="w-32 h-32 rounded-xl object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                      {product.post.wholesaleBand.name}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.post.title}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-3">{product.post.content}</p>
                  <Link
                    href={`/post/detail/${product.post.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
                  >
                    <FileText size={16} />
                    원본 게시물 보기
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 테스트 페이지 안내 */}
      <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
        디자인 C: 탭 기반 레이아웃
      </div>
    </div>
  )
}
