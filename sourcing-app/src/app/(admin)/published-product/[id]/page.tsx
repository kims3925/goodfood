'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Store, ExternalLink, Trash2, RotateCcw, Clock, CheckCircle, XCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface PublishedProductDetail {
  id: number
  userId: number
  productId: number
  channelId: number | null
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  externalId: string | null
  externalUrl: string | null
  errorMessage: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  product: {
    id: number
    name: string
    description: string | null
    thumbnailUrl: string | null
    price: number | null
    wholesalePrice: number | null
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

  useEffect(() => {
    loadProduct()
  }, [id])

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/published-product/${id}`)
      const data = await response.json()

      if (data.success) {
        setProduct(data.data)
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
  }

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

  const handleRetryPublish = async () => {
    toast.info('재발행 기능은 준비 중입니다.')
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle size={20} className="text-green-500" />
      case 'FAILED':
        return <XCircle size={20} className="text-red-500" />
      case 'PENDING':
      default:
        return <Clock size={20} className="text-yellow-500" />
    }
  }

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      PENDING: { label: '대기중', color: 'text-yellow-600 bg-yellow-100' },
      SUCCESS: { label: '발행완료', color: 'text-green-600 bg-green-100' },
      FAILED: { label: '발행실패', color: 'text-red-600 bg-red-100' },
    }
    const info = statusMap[status] || { label: status, color: 'text-gray-600 bg-gray-100' }
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${info.color}`}>
        {info.label}
      </span>
    )
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

  const thumbnailUrl = product.product.thumbnailUrl ||
    product.product.collectedProduct?.post?.images?.[0]?.imageUrl

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
            {product.externalUrl && (
              <Button
                variant="secondary"
                onClick={() => window.open(product.externalUrl!, '_blank')}
              >
                <ExternalLink size={16} />
                외부 링크
              </Button>
            )}
            {product.status === 'FAILED' && (
              <Button variant="primary" onClick={handleRetryPublish}>
                <RotateCcw size={16} />
                재발행
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">상품 이미지</h2>
              {thumbnailUrl ? (
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={thumbnailUrl}
                    alt={product.product.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
                  <Package size={48} className="text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* 상품 정보 섹션 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 발행 상태 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">발행 상태</h2>
                {getStatusLabel(product.status)}
              </div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">외부 ID</label>
                  <p className="text-gray-900 font-mono text-sm">
                    {product.externalId || '-'}
                  </p>
                </div>
              </div>
              {product.status === 'FAILED' && product.errorMessage && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg">
                  <label className="block text-sm font-medium text-red-700 mb-1">오류 메시지</label>
                  <p className="text-red-600 text-sm">{product.errorMessage}</p>
                </div>
              )}
            </div>

            {/* 상품 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">상품 정보</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">상품명</label>
                  <p className="text-gray-900 font-semibold">{product.product.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">도매가</label>
                  <p className="text-gray-900 font-semibold">{formatPrice(product.product.wholesalePrice)}</p>
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
              <div className="mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/product/detail/${product.productId}`)}
                >
                  상품 상세 보기
                  <ExternalLink size={14} />
                </Button>
              </div>
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
                      {getStatusIcon(history.status)}
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
