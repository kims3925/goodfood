'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Store, ArrowRight, ExternalLink, Trash2, ImageIcon } from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import ProductImageViewer from '@/components/ui/ProductImageViewer'

interface CollectedProductDetail {
  id: number
  userId: number
  postId: number
  name: string | null
  description: string | null
  currency: string
  price: number | null
  wholesalePrice: number | null
  rawMetadata: any
  createdAt: string
  updatedAt: string
  post: {
    id: number
    title: string
    content: string
    author: string | null
    externalId: string
    channel: {
      id: number
      name: string
      coverUrl: string | null
      platform: string
    }
    images: Array<{
      id: number
      url: string
      sortOrder: number
    }>
    comments: Array<{
      id: number
      author: string
      content: string
      createdAt: string
    }>
  }
  products: Array<{
    id: number
    name: string
    status: string
    price: number | null
    wholesalePrice: number | null
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
    publishedProducts: Array<{
      id: number
      status: string
      channel: {
        id: number
        name: string
        platform: string
      } | null
    }>
  }>
}

export default function CollectedProductDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()
  const toast = useToast()

  const [product, setProduct] = useState<CollectedProductDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadProduct()
  }, [id])

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/collected-product/${id}`)
      const data = await response.json()

      if (data.success) {
        setProduct(data.data)
      } else {
        toast.error('수집상품을 불러오는데 실패했습니다.')
        router.push('/collected-product/list')
      }
    } catch (error) {
      console.error('수집상품 조회 실패:', error)
      toast.error('수집상품을 불러오는데 실패했습니다.')
      router.push('/collected-product/list')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/collected-product/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        toast.success('수집상품이 삭제되었습니다.')
        router.push('/collected-product/list')
      } else {
        toast.error('수집상품 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('수집상품 삭제 실패:', error)
      toast.error('수집상품 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => router.push('/collected-product/list')}>
              <ArrowLeft size={16} />
              목록으로
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">수집상품 상세</h1>
          </div>
          <div className="flex gap-2">
            {product.products.length === 0 && (
              <Button
                variant="primary"
                onClick={() => router.push(`/product/list?collectedProductId=${product.id}`)}
              >
                <ArrowRight size={16} />
                상품으로 변환
              </Button>
            )}
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={16} />
              삭제
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 이미지 섹션 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon size={18} className="text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">
                  상품 이미지 ({product.post.images.length}개)
                </h2>
              </div>
              <ProductImageViewer
                images={product.post.images}
                productName={product.name || product.post.title}
                enableLightbox={true}
                showThumbnails={true}
                thumbnailSize="md"
              />
            </div>
          </div>

          {/* 상품 정보 섹션 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 기본 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">수집상품 정보</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">상품명</label>
                  <p className="text-gray-900">{product.name || '(미추출)'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">수집일</label>
                  <p className="text-gray-900">
                    {new Date(product.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">도매가</label>
                  <p className="text-gray-900 font-semibold">{formatPrice(product.wholesalePrice)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">판매가</label>
                  <p className="text-gray-900 font-semibold">{formatPrice(product.price)}</p>
                </div>
              </div>
              {product.description && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">설명</label>
                  <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
                </div>
              )}
            </div>

            {/* 출처 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">출처 정보</h2>
              <div className="flex items-center gap-3 mb-4">
                {product.post.channel.coverUrl ? (
                  <img
                    src={product.post.channel.coverUrl}
                    alt={product.post.channel.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                    <Store size={24} className="text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{product.post.channel.name}</p>
                  <p className="text-sm text-gray-500">{product.post.channel.platform}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">게시물 제목</label>
                  <p className="text-gray-900">{product.post.title}</p>
                </div>
                {product.post.author && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">작성자</label>
                    <p className="text-gray-900">{product.post.author}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 변환된 상품 목록 */}
            {product.products.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  변환된 상품 ({product.products.length})
                </h2>
                <div className="space-y-3">
                  {product.products.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                      onClick={() => router.push(`/product/detail/${p.id}`)}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatPrice(p.wholesalePrice)} / {formatPrice(p.price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            p.status === 'COLLECTED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {p.status === 'COLLECTED' ? '활성' : '보관'}
                        </span>
                        <span className="text-sm text-gray-500">
                          발행: {p.publishedProducts.length}건
                        </span>
                        <ExternalLink size={16} className="text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="수집상품 삭제"
        message="이 수집상품을 삭제하시겠습니까? 연결된 상품과의 연결이 해제됩니다."
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
