'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Store, Trash2, Pencil, X, Save } from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import Image from 'next/image'
import ImageSortable, { SortableImage } from '@/components/product/ImageSortable'

interface PublishedProductDetail {
  id: number
  userId: number
  productId: number
  channelId: number | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  product: {
    id: number
    name: string
    description: string | null
    thumbnailUrl: string | null
    price: number | null
    status: string
    variants: Array<{
      id: number
      optionSummary: string | null
      price: number
      stock: number
    }>
    options: Array<{
      id: number
      groupName: string
      value: string
    }>
    collectedProduct: {
      id: number
      name: string | null
      post: {
        id: number
        title: string
        channel: {
          id: number
          name: string
          platform: string
        }
        images: Array<{
          id: number
          imageUrl: string
          sortOrder: number
        }>
      }
    } | null
  }
  channel: {
    id: number
    name: string
    coverUrl: string | null
    platform: string
    kind: string
  } | null
  publishHistories: Array<{
    id: number
    status: string
    errorMessage: string | null
    publishedAt: string
  }>
}

export default function PublishedProductDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()
  const toast = useToast()

  const [product, setProduct] = useState<PublishedProductDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 상품 정보 수정 상태
  const [isEditingProduct, setIsEditingProduct] = useState(false)
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [productChanged, setProductChanged] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    price: '',
    description: '',
  })
  const [originalForm, setOriginalForm] = useState({
    name: '',
    price: '',
    description: '',
  })

  // 이미지 수정 상태
  const [isEditingImages, setIsEditingImages] = useState(false)
  const [isSavingImages, setIsSavingImages] = useState(false)
  const [images, setImages] = useState<SortableImage[]>([])
  const [imageOrderChanged, setImageOrderChanged] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null)

  const loadProduct = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/published-product/${id}`)
      const data = await response.json()

      if (data.success) {
        setProduct(data.data)
        // 편집 폼 초기화
        const formData = {
          name: data.data.product.name || '',
          price: data.data.product.price?.toString() || '',
          description: data.data.product.description || '',
        }
        setEditForm(formData)
        setOriginalForm(formData)
        setProductChanged(false)
        setIsEditingProduct(false)
        // 이미지 상태 초기화
        if (data.data.product.collectedProduct?.post?.images) {
          setImages(data.data.product.collectedProduct.post.images.map((img: any) => ({
            id: img.id,
            imageUrl: img.imageUrl,
            sortOrder: img.sortOrder,
          })))
        }
        setImageOrderChanged(false)
        setIsEditingImages(false)
      } else {
        toast.error('발행상품을 불러오는데 실패했습니다.')
        router.push('/published-product/list')
      }
    } catch (error) {
      console.error('발행상품 조회 실패:', error)
      toast.error('발행상품을 불러오는데 실패했습니다.')
      router.push('/published-product/list')
    } finally {
      setIsLoading(false)
    }
  }, [id, router, toast])

  useEffect(() => {
    loadProduct()
  }, [loadProduct])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/published-product/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        toast.success('발행상품이 삭제되었습니다.')
        router.push('/published-product/list')
      } else {
        toast.error('발행상품 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('발행상품 삭제 실패:', error)
      toast.error('발행상품 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  // 상품 정보 수정 시작
  const startEditingProduct = () => {
    setIsEditingProduct(true)
    setProductChanged(false)
  }

  // 상품 정보 수정 취소
  const cancelEditingProduct = () => {
    setEditForm(originalForm)
    setProductChanged(false)
    setIsEditingProduct(false)
  }

  // 상품 폼 변경 핸들러
  const handleFormChange = (field: string, value: string) => {
    const newForm = { ...editForm, [field]: value }
    setEditForm(newForm)
    // 원본과 비교하여 변경 여부 확인
    const hasChanged =
      newForm.name !== originalForm.name ||
      newForm.price !== originalForm.price ||
      newForm.description !== originalForm.description
    setProductChanged(hasChanged)
  }

  // 이미지 수정 시작
  const startEditingImages = () => {
    setIsEditingImages(true)
    setImageOrderChanged(false)
  }

  // 이미지 수정 취소
  const cancelEditingImages = () => {
    if (product?.product.collectedProduct?.post?.images) {
      setImages(product.product.collectedProduct.post.images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        sortOrder: img.sortOrder,
      })))
    }
    setImageOrderChanged(false)
    setIsEditingImages(false)
  }

  // 상품 정보 저장
  const handleSaveProduct = async () => {
    if (!product) return

    setIsSavingProduct(true)
    try {
      const response = await fetch(`/api/product/${product.productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          price: editForm.price ? parseInt(editForm.price) : null,
          description: editForm.description || null,
        }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success('상품 정보가 저장되었습니다.')
        // 원본 폼을 현재 폼으로 업데이트
        setOriginalForm(editForm)
        setProductChanged(false)
        setIsEditingProduct(false)
        loadProduct()
      } else {
        toast.error(data.error || '상품 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 저장 실패:', error)
      toast.error('상품 저장에 실패했습니다.')
    } finally {
      setIsSavingProduct(false)
    }
  }

  // 이미지 순서 저장
  const handleSaveImages = async () => {
    if (!product || !product.product.collectedProduct?.post?.id) {
      toast.error('게시물 정보를 찾을 수 없습니다.')
      return
    }

    if (images.length === 0) {
      toast.error('저장할 이미지가 없습니다.')
      return
    }

    setIsSavingImages(true)
    try {
      const response = await fetch('/api/post-image/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: product.product.collectedProduct.post.id,
          imageIds: images.map((img) => img.id),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `서버 오류 (${response.status})`)
      }

      const data = await response.json()

      if (data.success) {
        toast.success('이미지 순서가 저장되었습니다.')
        setImageOrderChanged(false)
        setIsEditingImages(false)
        loadProduct()
      } else {
        toast.error(data.error || '이미지 순서 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 순서 저장 실패:', error)
      const errorMessage = error instanceof Error ? error.message : '이미지 순서 저장에 실패했습니다.'
      toast.error(errorMessage)
    } finally {
      setIsSavingImages(false)
    }
  }

  // 이미지 순서 변경 핸들러
  const handleImageReorder = (newOrder: SortableImage[]) => {
    setImages(newOrder)
    setImageOrderChanged(true)
  }

  // 이미지 삭제 핸들러 (서버에서 바로 삭제됨)
  const handleDeleteImage = async (imageId: number) => {
    if (!product) return

    // 마지막 이미지 삭제 방지
    if (images.length <= 1) {
      toast.error('최소 1개의 이미지가 필요합니다.')
      return
    }

    setDeletingImageId(imageId)
    try {
      const response = await fetch(`/api/post-image/${imageId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `서버 오류 (${response.status})`)
      }

      const data = await response.json()
      if (data.success) {
        // 삭제된 이미지를 목록에서 제거 (서버에서 이미 삭제됨)
        setImages(prev => prev.filter(img => img.id !== imageId))
        toast.success('이미지가 삭제되었습니다.')
        // 데이터 새로고침
        loadProduct()
      } else {
        toast.error(data.error || '이미지 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 삭제 실패:', error)
      const errorMessage = error instanceof Error ? error.message : '이미지 삭제에 실패했습니다.'
      toast.error(errorMessage)
    } finally {
      setDeletingImageId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!product) {
    return null
  }

  const galleryImages = product.product.collectedProduct?.post?.images ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => router.push('/published-product/list')}>
              <ArrowLeft size={16} />
              목록으로
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">발행상품 상세</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={16} />
              삭제
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* 발행 정보 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">발행 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">발행 채널</label>
                <div className="flex items-center gap-2">
                  <Store size={16} className="text-gray-400" />
                  <span className="text-gray-900">
                    {product.channel?.name || '쇼핑몰'}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">플랫폼</label>
                <p className="text-gray-900">
                  {product.channel?.platform || 'SHOP'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">발행일시</label>
                <p className="text-gray-900">
                  {product.publishedAt
                    ? new Date(product.publishedAt).toLocaleString('ko-KR')
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* 상품 정보 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">상품 정보</h2>
              <div className="flex gap-2">
                {isEditingProduct ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={cancelEditingProduct}
                    >
                      <X size={14} />
                      취소
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveProduct}
                      disabled={!productChanged || isSavingProduct || !editForm.name}
                    >
                      <Save size={14} />
                      {isSavingProduct ? '저장 중...' : '저장'}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={startEditingProduct}>
                    <Pencil size={14} />
                    수정
                  </Button>
                )}
              </div>
            </div>
            {isEditingProduct ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상품명</label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="상품명을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">판매가</label>
                  <Input
                    type="number"
                    value={editForm.price}
                    onChange={(e) => handleFormChange('price', e.target.value)}
                    placeholder="판매가를 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={5}
                    value={editForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="상품 설명을 입력하세요"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-500 mb-1">상품명</label>
                    <p className="text-gray-900 font-semibold">{product.product.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">판매가</label>
                    <p className="text-gray-900 font-semibold">{formatPrice(product.product.price)}</p>
                  </div>
                </div>
                {product.product.description && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-500 mb-1">설명</label>
                    <p className="text-gray-700 whitespace-pre-wrap text-sm">
                      {product.product.description.substring(0, 300)}
                      {product.product.description.length > 300 && '...'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 사진 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">사진</h2>
              <div className="flex gap-2">
                {isEditingImages ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={cancelEditingImages}
                    >
                      <X size={14} />
                      취소
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveImages}
                      disabled={!imageOrderChanged || isSavingImages}
                    >
                      <Save size={14} />
                      {isSavingImages ? '저장 중...' : '저장'}
                    </Button>
                  </>
                ) : (
                  galleryImages.length > 0 && (
                    <Button size="sm" variant="secondary" onClick={startEditingImages}>
                      <Pencil size={14} />
                      수정
                    </Button>
                  )
                )}
              </div>
            </div>
            {isEditingImages ? (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  드래그하여 순서를 변경하거나, 호버하여 삭제할 수 있습니다. 첫 번째 이미지가 대표 이미지로 설정됩니다.
                </p>
                {images.length > 0 ? (
                  <ImageSortable
                    images={images}
                    onReorder={handleImageReorder}
                    onDelete={handleDeleteImage}
                    deletingImageId={deletingImageId ?? undefined}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <p className="text-sm">이미지가 없습니다</p>
                  </div>
                )}
              </>
            ) : (
              galleryImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                  {galleryImages.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative aspect-square rounded-lg overflow-hidden border border-dashed border-gray-200"
                    >
                      <Image
                        src={image.imageUrl}
                        alt={`상품 이미지 ${image.id}`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 240px"
                        className="object-cover"
                      />
                      {index === 0 && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
                          대표
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <p className="text-sm">이미지가 없습니다</p>
                </div>
              )
            )}
          </div>

          {/* 발행 이력 */}
          {product.publishHistories.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                발행 이력 ({product.publishHistories.length})
              </h2>
              <div className="space-y-3">
                {product.publishHistories.map((history) => (
                  <div
                    key={history.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">
                          {history.status === 'SUCCESS' ? '발행 성공' :
                            history.status === 'FAILED' ? '발행 실패' : '발행 대기'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(history.publishedAt).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      {history.errorMessage && (
                        <p className="text-sm text-red-600 mt-1">{history.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="발행상품 삭제"
        message="이 발행상품을 삭제하시겠습니까? 외부 플랫폼에서는 수동으로 삭제해야 합니다."
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
