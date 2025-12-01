'use client'

/**
 * 상품 상세 페이지 - 심플 모던 레이아웃
 * - 좌우 분할: 이미지 갤러리 좌측, 상품 정보 우측
 * - 깔끔한 카드 디자인
 * - 큰 이미지 미리보기 + 발행현황 탭
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Package, FileText, Trash2, AlertCircle, ChevronLeft, ChevronRight, Store, Calendar, ExternalLink } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Link from 'next/link'
import ImageSortable, { SortableImage } from '@/components/product/ImageSortable'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface Product {
  id: number
  collectedProductId: number | null
  name: string
  description: string | null
  status: 'COLLECTED' | 'ARCHIVED'
  thumbnailUrl: string | null
  price: number | null
  wholesalePrice: number | null
  categoryId: string | null
  currency: string
  createdAt: string
  updatedAt: string
  collectedProduct: {
    id: number
    post: {
      id: number
      title: string
      content: string
      channel: {
        id: number
        name: string
        coverUrl: string | null
      } | null
      images: Array<{
        id: number
        imageUrl: string
        name?: string
        sortOrder: number
      }>
    } | null
  } | null
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

interface PublishHistory {
  id: number
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  publishType: 'RETAIL_BAND' | 'SHOPPING_MALL'
  createdAt: string
  retailBand?: {
    id: number
    name: string
    bandKey: string
  }
}

type TabType = 'info' | 'publish'

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const toast = useToast()
  const productId = parseInt(params.id as string)

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
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

  // 이미지 관련 상태
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null)

  // 삭제 확인 모달 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 발행현황 상태
  const [publishHistory, setPublishHistory] = useState<PublishHistory[]>([])
  const [isLoadingPublish, setIsLoadingPublish] = useState(false)

  useEffect(() => {
    if (productId) {
      loadProduct()
    }
  }, [productId])

  useEffect(() => {
    if (activeTab === 'publish' && productId) {
      loadPublishHistory()
    }
  }, [activeTab, productId])

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
        // 이미지 상태 초기화
        if (data.data.collectedProduct?.post?.images) {
          setImages(data.data.collectedProduct.post.images.map((img: any) => ({
            id: img.id,
            imageUrl: img.imageUrl,
            name: img.name,
            sortOrder: img.sortOrder,
          })))
        }
        setImageOrderChanged(false)
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

  const loadPublishHistory = async () => {
    try {
      setIsLoadingPublish(true)
      const response = await fetch(`/api/product/publish?productId=${productId}`)
      const data = await response.json()

      if (data.success) {
        setPublishHistory(data.data || [])
      }
    } catch (err) {
      console.error('발행현황 로드 실패:', err)
    } finally {
      setIsLoadingPublish(false)
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
        toast.success('상품이 저장되었습니다.')
        loadProduct()
        setIsEditing(false)
      } else {
        toast.error('상품 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 저장 실패:', error)
      toast.error('상품 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (!product) return
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!product) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/product?id=${product.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        toast.success('상품이 삭제되었습니다.')
        router.push('/product/list')
      } else {
        toast.error('상품 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 삭제 실패:', error)
      toast.error('상품 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // 이미지 순서 변경 핸들러
  const handleImageReorder = (newOrder: SortableImage[]) => {
    setImages(newOrder)
    setImageOrderChanged(true)
  }

  // 이미지 순서 저장
  const handleSaveImageOrder = async () => {
    if (!product || images.length === 0) return
    const postId = product.collectedProduct?.post?.id
    if (!postId) return

    try {
      const response = await fetch('/api/post/image/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          imageIds: images.map((img) => img.id),
        }),
      })

      const data = await response.json()
      if (data.success) {
        loadProduct()
        toast.success('이미지 순서가 변경되었습니다.')
      } else {
        toast.error('이미지 순서 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 순서 저장 실패:', error)
    } finally {
      setIsReorderingSaving(false)
    }
  }

  // 이미지 순서 변경 취소
  const handleCancelImageReorder = () => {
    if (product?.collectedProduct?.post?.images) {
      setImages(product.collectedProduct.post.images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        name: img.name,
        sortOrder: img.sortOrder,
      })))
    }
    setImageOrderChanged(false)
    setIsImageReordering(false)
  }

  // 이미지 삭제 핸들러
  const handleDeleteImage = async (imageId: number) => {
    if (!product) return

    setDeletingImageId(imageId)
    try {
      const response = await fetch(`/api/post/image?id=${imageId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        loadProduct()
        toast.success('이미지가 삭제되었습니다.')
        // 삭제된 이미지가 현재 선택된 이미지인 경우 인덱스 조정
        if (selectedImageIndex >= images.length - 1) {
          setSelectedImageIndex(Math.max(0, images.length - 2))
        }
      } else {
        toast.error(data.error || '이미지 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 삭제 실패:', error)
      toast.error('이미지 삭제에 실패했습니다.')
    } finally {
      setDeletingImageId(null)
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

  const getPublishStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      PENDING: { label: '대기중', color: 'bg-yellow-100 text-yellow-800' },
      SUCCESS: { label: '성공', color: 'bg-green-100 text-green-800' },
      FAILED: { label: '실패', color: 'bg-red-100 text-red-800' },
    }
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  const getPublishTypeBadge = (type: string) => {
    const typeMap: { [key: string]: { label: string; color: string } } = {
      RETAIL_BAND: { label: '소매밴드', color: 'bg-purple-100 text-purple-800' },
      SHOPPING_MALL: { label: '쇼핑몰', color: 'bg-blue-100 text-blue-800' },
    }
    const typeInfo = typeMap[type] || { label: type, color: 'bg-gray-100 text-gray-800' }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
        {typeInfo.label}
      </span>
    )
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
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const images = product?.post?.images || []

  // ImageSortable용 이미지 변환
  const sortableImages: SortableImage[] = images.map((img) => ({
    id: img.id,
    imageUrl: img.imageUrl,
    sortOrder: img.sortOrder,
  }))

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

          {/* 탭 */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'info'
                  ? 'bg-gray-100 text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              상품 정보
            </button>
            <button
              onClick={() => setActiveTab('publish')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'publish'
                  ? 'bg-gray-100 text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              발행현황
              {publishHistory.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === 'publish' ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-600'
                }`}>
                  {publishHistory.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'info' ? (
          /* 상품 정보 탭 */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 좌측: 이미지 갤러리 */}
            <div className="space-y-4">
              {isEditing ? (
                /* 편집 모드: ImageSortable 사용 */
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">이미지 관리</h3>
                  <p className="text-sm text-gray-500 mb-4">드래그하여 순서를 변경하거나, 호버하여 삭제할 수 있습니다.</p>
                  {sortableImages.length > 0 ? (
                    <ImageSortable
                      images={sortableImages}
                      onReorder={handleImageReorder}
                      onDelete={handleDeleteImage}
                      deletingImageId={deletingImageId ?? undefined}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-48 bg-gray-100 rounded-xl">
                      <Package size={48} className="text-gray-300" />
                    </div>
                  )}
                </div>
              ) : (
                /* 보기 모드: 기존 갤러리 */
                <>
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
                </>
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

          {/* Row 2: 출처 게시물 + 메타데이터 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Source Post Card */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">출처 게시물</h2>
                {product.collectedProduct?.post && (
                  <Link
                    href={`/post/detail/${product.collectedProduct.post.id}`}
                    className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                  >
                    <FileText size={14} />
                    게시물 보기
                  </Link>
                )}
              </div>
              <div className="p-6 flex-1">
                <div className="flex items-start gap-4">
                  {product.collectedProduct?.post?.images[0]?.imageUrl && (
                    <img
                      src={product.collectedProduct.post.images[0].imageUrl}
                      alt={product.collectedProduct.post.title}
                      className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-purple-600">
                        {product.collectedProduct?.post?.channel?.name || '출처 미확인'}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">
                      {product.collectedProduct?.post?.title || '게시물 없음'}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {product.collectedProduct?.post?.content || '원본 게시물 내용을 찾을 수 없습니다.'}
                    </p>
                  </div>
                  <span className="text-gray-600 text-sm truncate">{product.post.title}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 발행현황 탭 */
          <div className="bg-white rounded-2xl shadow-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">발행 이력</h2>
              <p className="text-sm text-gray-500 mt-1">이 상품의 발행 현황을 확인할 수 있습니다.</p>
            </div>
            <div className="p-6">
              {isLoadingPublish ? (
                <div className="flex justify-center py-12">
                  <Loading />
                </div>
              ) : publishHistory.length > 0 ? (
                <div className="space-y-4">
                  {publishHistory.map((publish) => (
                    <div
                      key={publish.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <Store size={20} className="text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {getPublishTypeBadge(publish.publishType)}
                            {publish.retailBand && (
                              <span className="font-medium text-gray-900">
                                {publish.retailBand.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <Calendar size={14} />
                            {formatDate(publish.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getPublishStatusBadge(publish.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Store size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">발행 이력이 없습니다.</p>
                  <p className="text-sm text-gray-400 mt-1">상품을 발행하면 이곳에 표시됩니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="상품 삭제"
        message="정말 이 상품을 삭제하시겠습니까?"
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
