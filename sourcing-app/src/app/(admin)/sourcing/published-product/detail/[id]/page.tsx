'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Store, Trash2, ImageIcon, Package, Calendar, Globe, DollarSign, Clock, Info, ExternalLink, ToggleLeft, ToggleRight, Power } from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import ProductImageViewer from '@/components/ui/ProductImageViewer'
import Link from 'next/link'

interface PublishedProductDetail {
  id: number
  userId: number
  productId: number | null
  channelId: number | null
  shopId: number | null
  isActive: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  product: {
    id: number
    name: string
    description: string | null
    thumbnailUrl: string | null
    status: string
    variants: Array<{
      id: number
      optionSummary: string | null
      price: number
    }>
    options: Array<{
      id: number
      groupName: string
      value: string
    }>
    images: Array<{
      id: number
      url: string
      sortOrder: number
    }>
    // 같은 상품의 모든 발행 정보
    publishedProducts: Array<{
      id: number
      channelId: number | null
      shopId: number | null
      isActive: boolean
      publishedAt: string | null
      createdAt: string
      channel: {
        id: number
        name: string
        coverUrl: string | null
        platform: string
        kind: string
      } | null
      shop: {
        id: number
        name: string
        subdomain: string
        isActive: boolean
      } | null
    }>
  } | null
  channel: {
    id: number
    name: string
    coverUrl: string | null
    platform: string
    kind: string
  } | null
  shop: {
    id: number
    name: string
    subdomain: string
    isActive: boolean
  } | null
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


  const loadProduct = useCallback(async () => {
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

  // 발행상품 활성화/비활성화 토글
  const handleToggleActive = async (publishId: number, currentIsActive: boolean) => {
    try {
      const response = await fetch(`/api/published-product/${publishId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentIsActive }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(currentIsActive ? '발행상품이 비활성화되었습니다.' : '발행상품이 활성화되었습니다.')
        loadProduct()
      } else {
        toast.error('상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('상태 변경 실패:', error)
      toast.error('상태 변경에 실패했습니다.')
    }
  }

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return '-'
    return `₩${price.toLocaleString()}`
  }

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  // variant에서 대표 가격 추출
  const getMainPrice = () => {
    return product?.product?.variants?.[0]?.price ?? null
  }

  // product가 null인 경우 (원본 상품이 삭제된 경우) 체크
  const isProductDeleted = !product?.product

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!product) {
    return null
  }

  const galleryImages = product.product?.images ?? []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 상단 네비게이션 바 */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/published-product/list')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="font-medium">목록</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-slate-200"></div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-slate-400 text-sm">발행상품</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 text-sm font-medium truncate max-w-[200px]">
                  {product.product?.name || '삭제된 상품'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                className="!px-4 !py-2"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">삭제</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 안내 문구 */}
        {isProductDeleted ? (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                <Info size={18} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  원본 상품이 삭제되었습니다.
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  이 발행상품과 연결된 원본 상품이 삭제되어 상품 정보를 확인할 수 없습니다.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <Info size={18} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  발행상품의 정보를 수정하려면 원본 상품을 수정해주세요.
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  상품 관리에서 원본 상품을 수정하면 이 발행상품에도 자동으로 반영됩니다.
                </p>
                <Link
                  href={`/product/detail/${product.productId}`}
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <ExternalLink size={14} />
                  원본 상품 수정하기
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* 왼쪽: 이미지 갤러리 */}
          <div className="xl:col-span-5 2xl:col-span-4">
            <div className="xl:sticky xl:top-24">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <ImageIcon size={18} className="text-slate-600" />
                    </div>
                    <span className="font-semibold text-slate-900">상품 이미지</span>
                    {galleryImages.length > 0 && (
                      <span className="text-sm text-slate-500">({galleryImages.length}개)</span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  {galleryImages.length > 0 ? (
                    <ProductImageViewer
                      images={galleryImages}
                      productName={product.product?.name || '삭제된 상품'}
                      enableLightbox={true}
                      showThumbnails={true}
                      thumbnailSize="md"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <ImageIcon size={48} className="mb-2" />
                      <p className="text-sm">{isProductDeleted ? '원본 상품이 삭제되어 이미지를 확인할 수 없습니다' : '이미지가 없습니다'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 상품 정보 */}
          <div className="xl:col-span-7 2xl:col-span-8 space-y-6">
            {/* 발행 정보 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Globe size={18} className="text-emerald-600" />
                  </div>
                  <span className="font-semibold text-slate-900">발행 정보</span>
                  {(product.product?.publishedProducts?.length ?? 0) > 0 && (
                    <span className="px-2 py-0.5 bg-slate-200 rounded-full text-xs font-medium text-slate-600">
                      {product.product?.publishedProducts?.length}개 발행처
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* 밴드 섹션 */}
                {(() => {
                  const bandPublishes = (product.product?.publishedProducts ?? []).filter(pub => pub.channelId !== null && pub.shopId === null)
                  if (bandPublishes.length === 0) return null
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-purple-100 rounded-lg">
                          <Store size={14} className="text-purple-600" />
                        </div>
                        <span className="font-semibold text-slate-700 text-sm">밴드</span>
                        <span className="px-2 py-0.5 bg-purple-100 rounded-full text-xs font-medium text-purple-600">
                          {bandPublishes.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {bandPublishes.map((pub) => (
                          <div
                            key={pub.id}
                            className="flex items-center justify-between p-3 rounded-xl border bg-purple-50/50 border-purple-100 hover:border-purple-200 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {pub.channel?.coverUrl ? (
                                <img
                                  src={pub.channel.coverUrl}
                                  alt={pub.channel.name}
                                  className="w-10 h-10 rounded-lg object-cover ring-1 ring-purple-200 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0">
                                  <Store size={18} className="text-purple-600" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-slate-900">{pub.channel?.name || '알 수 없음'}</p>
                                <p className="text-xs text-slate-500">
                                  {formatDateTime(pub.publishedAt || pub.createdAt)}
                                </p>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                              {pub.channel?.platform || '밴드'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* 쇼핑몰 섹션 */}
                {(() => {
                  const shopPublishes = (product.product?.publishedProducts ?? []).filter(pub => pub.shopId !== null)
                  if (shopPublishes.length === 0) return null
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-blue-100 rounded-lg">
                          <Store size={14} className="text-blue-600" />
                        </div>
                        <span className="font-semibold text-slate-700 text-sm">쇼핑몰</span>
                        <span className="px-2 py-0.5 bg-blue-100 rounded-full text-xs font-medium text-blue-600">
                          {shopPublishes.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {shopPublishes.map((pub) => (
                          <div
                            key={pub.id}
                            className="flex items-center justify-between p-3 rounded-xl border bg-blue-50/50 border-blue-100 hover:border-blue-200 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                                <Store size={18} className="text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{pub.shop?.name || '알 수 없음'}</p>
                                <p className="text-xs text-slate-500">
                                  {formatDateTime(pub.publishedAt || pub.createdAt)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleActive(pub.id, pub.isActive)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                                  pub.isActive
                                    ? 'text-green-700 bg-green-50 hover:bg-green-100'
                                    : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                                }`}
                                title={pub.isActive ? '활성화됨 (클릭하여 비활성화)' : '비활성화됨 (클릭하여 활성화)'}
                              >
                                {pub.isActive ? (
                                  <ToggleRight size={14} />
                                ) : (
                                  <ToggleLeft size={14} />
                                )}
                                {pub.isActive ? '활성' : '비활성'}
                              </button>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                쇼핑몰
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* 현재 발행 정보 요약 */}
                <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                      <Calendar size={18} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">발행일시</p>
                      <p className="font-medium text-slate-900">
                        {formatDateTime(product.publishedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                      <Clock size={18} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">등록일시</p>
                      <p className="font-medium text-slate-900">
                        {formatDateTime(product.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 상품 정보 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package size={18} className="text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-900">상품 정보</span>
                </div>
              </div>

              <div className="p-6">
                {isProductDeleted ? (
                  <div className="text-center py-8">
                    <Package size={48} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">원본 상품이 삭제되어 상품 정보를 확인할 수 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">상품명</label>
                      <h1 className="text-xl font-bold text-slate-900">{product.product?.name}</h1>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-xl">
                        <DollarSign size={18} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">판매가</p>
                        <p className="text-xl font-bold text-slate-900">{formatPrice(getMainPrice())}</p>
                      </div>
                    </div>

                    {product.product?.description && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">설명</label>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                            {product.product.description.length > 300
                              ? `${product.product.description.substring(0, 300)}...`
                              : product.product.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

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
