'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Package, FileText, Trash2, AlertCircle, GripVertical } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import Link from 'next/link'
import ImageSortable, { SortableImage } from '@/components/product/ImageSortable'

interface Product {
  id: number
  postId: number
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SOLDOUT'
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

export default function ProductDetailPage() {
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

  // 이미지 순서 변경 상태
  const [images, setImages] = useState<SortableImage[]>([])
  const [isImageReordering, setIsImageReordering] = useState(false)
  const [imageOrderChanged, setImageOrderChanged] = useState(false)
  const [isReorderingSaving, setIsReorderingSaving] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null)

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
        // 이미지 상태 초기화
        if (data.data.post?.images) {
          setImages(data.data.post.images.map((img: any) => ({
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

  const handleStartEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        categoryId: product.categoryId || '',
        price: product.price?.toString() || '',
        wholesalePrice: product.wholesalePrice?.toString() || '',
      })
    }
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!product || !formData.name.trim()) {
      return
    }

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

  const handleUpdateStatus = async (newStatus: Product['status']) => {
    if (!product) return

    try {
      const response = await fetch('/api/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          status: newStatus,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setProduct({ ...product, status: newStatus })
      }
    } catch (error) {
      console.error('상태 변경 실패:', error)
    }
  }

  const handleDelete = async () => {
    if (!product) return
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/product?id=${product.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        router.push('/product/list')
      }
    } catch (error) {
      console.error('상품 삭제 실패:', error)
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

    try {
      setIsReorderingSaving(true)
      const response = await fetch('/api/post-image/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: product.postId,
          imageIds: images.map((img) => img.id),
        }),
      })

      const data = await response.json()
      if (data.success) {
        setImageOrderChanged(false)
        setIsImageReordering(false)
        // 상품 정보 다시 로드하여 thumbnailUrl 갱신
        loadProduct()
      } else {
        console.error('이미지 순서 저장 실패:', data.error)
      }
    } catch (error) {
      console.error('이미지 순서 저장 실패:', error)
    } finally {
      setIsReorderingSaving(false)
    }
  }

  // 이미지 순서 변경 취소
  const handleCancelImageReorder = () => {
    if (product?.post?.images) {
      setImages(product.post.images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        name: img.name,
        sortOrder: img.sortOrder,
      })))
    }
    setImageOrderChanged(false)
    setIsImageReordering(false)
  }

  // 이미지 삭제
  const handleDeleteImage = async (imageId: number) => {
    try {
      setDeletingImageId(imageId)
      const response = await fetch(`/api/post-image/${imageId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        // 로컬 상태에서 이미지 제거
        setImages(prev => prev.filter(img => img.id !== imageId).map((img, index) => ({
          ...img,
          sortOrder: index,
        })))
        // product 상태의 thumbnailUrl 업데이트
        if (product) {
          setProduct({
            ...product,
            thumbnailUrl: data.data.newThumbnailUrl,
          })
        }
      } else {
        console.error('이미지 삭제 실패:', data.error)
        alert(data.error || '이미지 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 삭제 실패:', error)
      alert('이미지 삭제에 실패했습니다.')
    } finally {
      setDeletingImageId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      DRAFT: { label: '임시저장', color: 'bg-gray-100 text-gray-800' },
      ACTIVE: { label: '판매중', color: 'bg-green-100 text-green-800' },
      INACTIVE: { label: '판매중지', color: 'bg-yellow-100 text-yellow-800' },
      SOLDOUT: { label: '품절', color: 'bg-red-100 text-red-800' },
    }

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR')
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
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-red-500" size={48} />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">상품을 찾을 수 없습니다</h3>
                <p className="text-gray-600">{error}</p>
              </div>
              <Button variant="primary" onClick={() => router.push('/product/list')}>
                상품 목록으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/product/list')}>
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">상품 상세</h1>
              <p className="text-gray-600 mt-1">상품 정보를 확인하고 수정할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="secondary" onClick={handleCancelEdit}>
                  <X size={16} />
                  취소
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                  <Save size={16} />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={handleStartEdit}>
                  <Edit size={16} />
                  수정
                </Button>
                <Button variant="danger" onClick={handleDelete}>
                  <Trash2 size={16} />
                  삭제
                </Button>
              </>
            )}
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
                {/* Thumbnail & Name */}
                <div className="flex gap-6">
                  {product.thumbnailUrl ? (
                    <img
                      src={product.thumbnailUrl}
                      alt={product.name}
                      className="w-32 h-32 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Package size={48} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500 mb-2 block">
                            상품명 <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="상품명"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500 mb-2 block">설명</label>
                          <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="상품 설명"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={8}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h3>
                        {product.description && (
                          <p className="text-gray-600 whitespace-pre-wrap">{product.description}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">카테고리</label>
                    {isEditing ? (
                      <Input
                        type="text"
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        placeholder="카테고리"
                      />
                    ) : (
                      <p className="text-gray-900">{product.categoryId || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">판매가</label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0"
                      />
                    ) : (
                      <p className="text-lg font-semibold text-gray-900">{formatPrice(product.price)}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">도매가</label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={formData.wholesalePrice}
                        onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                        placeholder="0"
                      />
                    ) : (
                      <p className="text-lg font-semibold text-gray-900">{formatPrice(product.wholesalePrice)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">상태 관리</h2>
              </div>
              <div className="p-6 space-y-4 flex-1">
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">현재 상태</label>
                  {getStatusBadge(product.status)}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">상태 변경</label>
                  <div className="space-y-2">
                    <Button
                      variant={product.status === 'ACTIVE' ? 'primary' : 'secondary'}
                      onClick={() => handleUpdateStatus('ACTIVE')}
                      disabled={product.status === 'ACTIVE'}
                      className="w-full"
                    >
                      판매중으로 변경
                    </Button>
                    <Button
                      variant={product.status === 'INACTIVE' ? 'primary' : 'secondary'}
                      onClick={() => handleUpdateStatus('INACTIVE')}
                      disabled={product.status === 'INACTIVE'}
                      className="w-full"
                    >
                      판매중지로 변경
                    </Button>
                    <Button
                      variant={product.status === 'SOLDOUT' ? 'primary' : 'secondary'}
                      onClick={() => handleUpdateStatus('SOLDOUT')}
                      disabled={product.status === 'SOLDOUT'}
                      className="w-full"
                    >
                      품절로 변경
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 이미지 갤러리 카드 */}
          {images.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    상품 이미지
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({images.length}개)
                    </span>
                  </h2>
                  {isImageReordering && (
                    <p className="text-sm text-gray-500 mt-1">
                      드래그하여 이미지 순서를 변경하세요. 첫 번째 이미지가 대표 이미지가 됩니다.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {isImageReordering ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCancelImageReorder}
                        disabled={isReorderingSaving}
                      >
                        <X size={16} />
                        취소
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveImageOrder}
                        disabled={isReorderingSaving || !imageOrderChanged}
                      >
                        {isReorderingSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            저장 중...
                          </>
                        ) : (
                          <>
                            <Save size={16} />
                            순서 저장
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsImageReordering(true)}
                    >
                      <GripVertical size={16} />
                      순서 변경
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-6">
                {isImageReordering ? (
                  <>
                    <ImageSortable
                      images={images}
                      onReorder={handleImageReorder}
                      onDelete={handleDeleteImage}
                      deletingImageId={deletingImageId}
                    />
                    {imageOrderChanged && (
                      <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-sm text-orange-800">
                          이미지 순서가 변경되었습니다. &quot;순서 저장&quot; 버튼을 눌러 변경사항을 저장하세요.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {images.map((image, index) => (
                      <div key={image.id} className="relative">
                        {index === 0 && (
                          <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
                            대표
                          </div>
                        )}
                        <img
                          src={image.imageUrl}
                          alt={`상품 이미지 ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Options Card (조건부, 전체 너비) */}
          {Object.keys(groupedOptions).length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">옵션 정보</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {Object.entries(groupedOptions).map(([groupName, values]) => (
                    <div key={groupName}>
                      <label className="text-sm font-medium text-gray-700">{groupName}</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {values.map((value, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-50 text-purple-700 border border-purple-200"
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Row 2: 출처 게시물 + 메타데이터 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Source Post Card */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">출처 게시물</h2>
                <Link
                  href={`/post/detail/${product.post.id}`}
                  className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                >
                  <FileText size={14} />
                  게시물 보기
                </Link>
              </div>
              <div className="p-6 flex-1">
                <div className="flex items-start gap-4">
                  {product.post.images[0]?.imageUrl && (
                    <img
                      src={product.post.images[0].imageUrl}
                      alt={product.post.title}
                      className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-purple-600">
                        {product.post.wholesaleBand.name}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">{product.post.title}</h4>
                    <p className="text-sm text-gray-600 line-clamp-2">{product.post.content}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">메타데이터</h2>
              </div>
              <div className="p-6 space-y-3 flex-1">
                <div>
                  <label className="text-sm font-medium text-gray-500">생성일</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(product.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">수정일</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(product.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
