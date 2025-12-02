'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Package, FileText, Trash2, AlertCircle, ChevronLeft, ChevronRight, Store, Calendar, ExternalLink, ImageIcon, Tag, DollarSign, Layers, History } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Link from 'next/link'
import ImageSortable, { SortableImage } from '@/components/product/ImageSortable'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface ProductImage {
  id: number
  url: string
  sortOrder: number
}

interface Product {
  id: number
  collectedProductId: number | null
  name: string
  description: string | null
  thumbnailUrl: string | null
  price: number | null
  categoryId: string | null
  currency: string
  createdAt: string
  updatedAt: string
  images: ProductImage[]
  collectedProduct?: {
    id: number
    post?: {
      id: number
      title: string
      content: string | null
      channel: {
        id: number
        name: string
        coverUrl: string | null
      }
      images: Array<{
        id: number
        imageUrl: string
      }>
    }
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

  // 편집 모드 상태 (카드별 분리)
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [isEditingImages, setIsEditingImages] = useState(false)
  const [isSavingInfo, setIsSavingInfo] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    price: '',
  })

  // 이미지 관련 상태
  const [images, setImages] = useState<SortableImage[]>([])
  const [imageOrderChanged, setImageOrderChanged] = useState(false)
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
        })
        if (data.data.images) {
          setImages(data.data.images.map((img: any) => ({
            id: img.id,
            url: img.url,
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

  const handleSaveInfo = async () => {
    if (!product || !formData.name.trim()) return

    setIsSavingInfo(true)
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
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('상품 정보가 저장되었습니다.')
        loadProduct()
        setIsEditingInfo(false)
      } else {
        toast.error('상품 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 저장 실패:', error)
      toast.error('상품 저장에 실패했습니다.')
    } finally {
      setIsSavingInfo(false)
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

  const handleImageReorder = (newOrder: SortableImage[]) => {
    setImages(newOrder)
    setImageOrderChanged(true)
  }

  const handleSaveImageOrder = async () => {
    if (!product || images.length === 0) return

    try {
      const response = await fetch('/api/images/product/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
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
    }
  }

  const handleDeleteImage = async (imageId: number) => {
    if (!product) return

    setDeletingImageId(imageId)
    try {
      const response = await fetch(`/api/images/product/${imageId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        loadProduct()
        toast.success('이미지가 삭제되었습니다.')
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

  const getPublishStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; bgColor: string; textColor: string; dotColor: string } } = {
      PENDING: { label: '대기중', bgColor: 'bg-amber-50', textColor: 'text-amber-700', dotColor: 'bg-amber-500' },
      SUCCESS: { label: '성공', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', dotColor: 'bg-emerald-500' },
      FAILED: { label: '실패', bgColor: 'bg-red-50', textColor: 'text-red-700', dotColor: 'bg-red-500' },
    }
    const statusInfo = statusMap[status] || { label: status, bgColor: 'bg-slate-100', textColor: 'text-slate-700', dotColor: 'bg-slate-500' }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.textColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`}></span>
        {statusInfo.label}
      </span>
    )
  }

  const getPublishTypeBadge = (type: string) => {
    const typeMap: { [key: string]: { label: string; bgColor: string; textColor: string } } = {
      RETAIL_BAND: { label: '소매밴드', bgColor: 'bg-violet-50', textColor: 'text-violet-700' },
      SHOPPING_MALL: { label: '쇼핑몰', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
    }
    const typeInfo = typeMap[type] || { label: type, bgColor: 'bg-slate-100', textColor: 'text-slate-700' }
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${typeInfo.bgColor} ${typeInfo.textColor}`}>
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

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const groupedOptions = (product?.options || []).reduce((acc, option) => {
    if (!acc[option.groupName]) {
      acc[option.groupName] = []
    }
    acc[option.groupName].push(option.value)
    return acc
  }, {} as Record<string, string[]>)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-2xl flex items-center justify-center">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-slate-900">상품을 찾을 수 없습니다</h3>
          <p className="text-slate-500 mb-6">{error}</p>
          <Button variant="primary" onClick={() => router.push('/product/list')}>
            상품 목록으로 돌아가기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 상단 네비게이션 바 */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/product/list')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="font-medium">목록</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-slate-200"></div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-slate-400 text-sm">상품</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 text-sm font-medium truncate max-w-[200px]">
                  {product.name}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                onClick={handleDelete}
                className="!px-4 !py-2"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">삭제</span>
              </Button>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-1 -mb-px">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'info'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              상품 정보
            </button>
            <button
              onClick={() => setActiveTab('publish')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'publish'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              발행현황
              {publishHistory.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === 'publish' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'
                }`}>
                  {publishHistory.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'info' ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* 왼쪽: 이미지 갤러리 */}
            <div className="xl:col-span-5 2xl:col-span-4">
              <div className="xl:sticky xl:top-32">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  {isEditingImages ? (
                    <>
                      <div className="p-4 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              <ImageIcon size={18} className="text-slate-600" />
                            </div>
                            <span className="font-semibold text-slate-900">이미지 관리</span>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsEditingImages(false)}
                          >
                            <X size={14} className="mr-1" />
                            닫기
                          </Button>
                        </div>
                        <p className="text-sm text-slate-500 mt-2">드래그하여 순서를 변경하거나, 호버하여 삭제할 수 있습니다.</p>
                      </div>
                      <div className="p-4">
                        {images.length > 0 ? (
                          <>
                            <ImageSortable
                              images={images}
                              onReorder={handleImageReorder}
                              onDelete={handleDeleteImage}
                              deletingImageId={deletingImageId ?? undefined}
                            />
                            {imageOrderChanged && (
                              <div className="mt-4 flex justify-end">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={handleSaveImageOrder}
                                >
                                  <Save size={14} className="mr-1" />
                                  이미지 순서 저장
                                </Button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-48 bg-slate-50 rounded-xl">
                            <Package size={48} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {images.length > 0 ? (
                        <>
                          <div className="p-4 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                  <ImageIcon size={18} className="text-slate-600" />
                                </div>
                                <span className="font-semibold text-slate-900">상품 이미지</span>
                                <span className="text-sm text-slate-500">({images.length}개)</span>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsEditingImages(true)}
                              >
                                <Edit size={14} className="mr-1" />
                                수정
                              </Button>
                            </div>
                          </div>
                          <div className="relative aspect-square bg-slate-50">
                            <img
                              src={images[selectedImageIndex]?.url}
                              alt={`상품 이미지 ${selectedImageIndex + 1}`}
                              className="w-full h-full object-contain"
                            />
                            {images.length > 1 && (
                              <>
                                <button
                                  onClick={handlePrevImage}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                                >
                                  <ChevronLeft size={20} />
                                </button>
                                <button
                                  onClick={handleNextImage}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                                >
                                  <ChevronRight size={20} />
                                </button>
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 text-white text-sm rounded-full">
                                  {selectedImageIndex + 1} / {images.length}
                                </div>
                              </>
                            )}
                          </div>
                          {images.length > 1 && (
                            <div className="p-4 flex gap-2 overflow-x-auto">
                              {images.map((image, index) => (
                                <button
                                  key={image.id}
                                  onClick={() => setSelectedImageIndex(index)}
                                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                                    selectedImageIndex === index ? 'border-blue-500' : 'border-transparent hover:border-slate-300'
                                  }`}
                                >
                                  <img src={image.url} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-12 text-center">
                          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                            <ImageIcon size={32} className="text-slate-400" />
                          </div>
                          <p className="text-slate-500 font-medium">이미지가 없습니다</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 오른쪽: 상품 정보 */}
            <div className="xl:col-span-7 2xl:col-span-8 space-y-6">
              {/* 기본 정보 카드 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Package size={18} className="text-blue-600" />
                      </div>
                      <span className="font-semibold text-slate-900">기본 정보</span>
                    </div>
                    {isEditingInfo ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setIsEditingInfo(false)
                            setFormData({
                              name: product?.name || '',
                              description: product?.description || '',
                              categoryId: product?.categoryId || '',
                              price: product?.price?.toString() || '',
                            })
                          }}
                        >
                          <X size={14} className="mr-1" />
                          취소
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSaveInfo}
                          disabled={isSavingInfo}
                        >
                          <Save size={14} className="mr-1" />
                          {isSavingInfo ? '저장중...' : '저장'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsEditingInfo(true)}
                      >
                        <Edit size={14} className="mr-1" />
                        수정
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {isEditingInfo ? (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">상품명</label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="!rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">설명</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows={6}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">판매가</label>
                        <Input
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="!rounded-xl"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">상품명</label>
                        <h1 className="text-xl font-bold text-slate-900">{product.name}</h1>
                      </div>

                      {product.description && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">설명</label>
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                              {product.description}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-xl">
                            <DollarSign size={18} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">판매가</p>
                            <p className="text-xl font-bold text-slate-900">{formatPrice(product.price)}</p>
                          </div>
                        </div>
                        {product.categoryId && (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                              <Tag size={18} className="text-slate-500" />
                            </div>
                            <div>
                              <p className="text-slate-500 text-xs">카테고리</p>
                              <p className="font-medium text-slate-900">{product.categoryId}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 옵션 정보 */}
              {Object.keys(groupedOptions).length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-violet-100 rounded-lg">
                        <Layers size={18} className="text-violet-600" />
                      </div>
                      <span className="font-semibold text-slate-900">옵션</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {Object.entries(groupedOptions).map(([groupName, values]) => (
                      <div key={groupName}>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{groupName}</label>
                        <div className="flex flex-wrap gap-2">
                          {values.map((value, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium"
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

              {/* 원본 게시물 정보 */}
              {product.collectedProduct?.post && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <FileText size={18} className="text-amber-600" />
                      </div>
                      <span className="font-semibold text-slate-900">원본 게시물 정보</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      {product.collectedProduct.post.channel.coverUrl ? (
                        <img
                          src={product.collectedProduct.post.channel.coverUrl}
                          alt={product.collectedProduct.post.channel.name}
                          className="w-10 h-10 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
                          <Store size={18} className="text-slate-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-slate-500 text-xs">출처 채널</p>
                        <p className="font-medium text-slate-900">{product.collectedProduct.post.channel.name}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-500 text-xs mb-1">게시물 제목</p>
                      <p className="text-slate-900 font-medium">{product.collectedProduct.post.title}</p>
                    </div>

                    <Link
                      href={`/collected-product/${product.collectedProductId}`}
                      className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 text-sm font-medium transition-colors"
                    >
                      <ExternalLink size={16} />
                      수집 상품 상세 보기
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 발행현황 탭 */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <History size={18} className="text-emerald-600" />
                </div>
                <span className="font-semibold text-slate-900">발행 이력</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">이 상품의 발행 현황을 확인할 수 있습니다.</p>
            </div>

            <div className="p-6">
              {isLoadingPublish ? (
                <div className="flex justify-center py-12">
                  <Loading />
                </div>
              ) : publishHistory.length > 0 ? (
                <div className="space-y-3">
                  {publishHistory.map((publish) => (
                    <div
                      key={publish.id}
                      className="group relative bg-gradient-to-r from-slate-50 to-white p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                            <Store size={20} className="text-violet-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              {getPublishTypeBadge(publish.publishType)}
                              {publish.retailBand && (
                                <span className="font-medium text-slate-900">
                                  {publish.retailBand.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                              <Calendar size={14} />
                              {formatDate(publish.createdAt)}
                            </div>
                          </div>
                        </div>
                        {getPublishStatusBadge(publish.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Store size={32} className="text-slate-400" />
                  </div>
                  <p className="text-slate-500 font-medium">발행 이력이 없습니다</p>
                  <p className="text-sm text-slate-400 mt-1">상품을 발행하면 이곳에 표시됩니다</p>
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
        message="정말 이 상품을 삭제하시겠습니까? 삭제된 상품은 복구할 수 없습니다."
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
