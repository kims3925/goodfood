'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Store, ExternalLink, Trash2, ImageIcon, Calendar, User, FileText, ShoppingBag, Layers, Grid3X3, Truck, RefreshCw } from 'lucide-react'
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
  rawMetadata: any
  createdAt: string
  updatedAt: string
  isConverted: boolean
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
    variants: Array<{
      id: number
      optionSummary: string | null
      price: number
      wholesalePrice: number | null
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

export default function CollectedProductDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()

  const [product, setProduct] = useState<CollectedProductDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingConversion, setIsUpdatingConversion] = useState(false)

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

  const handleConversionStatusChange = async (newStatus: boolean) => {
    if (!product) return

    setIsUpdatingConversion(true)
    try {
      const response = await fetch(`/api/collected-product/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isConverted: newStatus }),
      })
      const data = await response.json()

      if (data.success) {
        setProduct({ ...product, isConverted: newStatus })
        toast.success(newStatus ? '변환 완료로 변경되었습니다.' : '미변환으로 변경되었습니다.')
      } else {
        toast.error('변환 상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('변환 상태 변경 실패:', error)
      toast.error('변환 상태 변경에 실패했습니다.')
    } finally {
      setIsUpdatingConversion(false)
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!product) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 상단 네비게이션 바 */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/collected-product/list')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="font-medium">목록</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-slate-200"></div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-slate-400 text-sm">수집상품</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 text-sm font-medium truncate max-w-[200px]">
                  {product.name || product.post.title || `#${product.id}`}
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
        {/* 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* 왼쪽: 이미지 갤러리 */}
          <div className="xl:col-span-5 2xl:col-span-4">
            <div className="xl:sticky xl:top-24">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {product.post.images && product.post.images.length > 0 ? (
                  <>
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <ImageIcon size={18} className="text-slate-600" />
                        </div>
                        <span className="font-semibold text-slate-900">상품 이미지</span>
                        <span className="text-sm text-slate-500">({product.post.images.length}개)</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <ProductImageViewer
                        images={product.post.images}
                        productName={product.name || product.post.title}
                        enableLightbox={true}
                        showThumbnails={true}
                        thumbnailSize="md"
                      />
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                      <ImageIcon size={32} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">이미지가 없습니다</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 오른쪽: 상품 정보 */}
          <div className="xl:col-span-7 2xl:col-span-8 space-y-6">
            {/* 헤더 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  {product.post.channel.coverUrl ? (
                    <img
                      src={product.post.channel.coverUrl}
                      alt={product.post.channel.name}
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                      <Store size={24} className="text-slate-500" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-slate-500">출처 채널</p>
                    <p className="font-semibold text-slate-900">{product.post.channel.name}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  {product.post.channel.platform}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm col-span-2">
                  <Calendar size={16} className="text-slate-400" />
                  <span className="text-slate-500">수집일:</span>
                  <span className="font-medium text-slate-700">
                    {new Date(product.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm col-span-2">
                  <RefreshCw size={16} className="text-slate-400" />
                  <span className="text-slate-500">변환 상태:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleConversionStatusChange(!product.isConverted)}
                      disabled={isUpdatingConversion}
                      className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out
                        focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                        ${product.isConverted ? 'bg-emerald-500' : 'bg-slate-300'}
                        ${isUpdatingConversion ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                      `}
                    >
                      <span
                        className={`
                          inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out
                          ${product.isConverted ? 'translate-x-6' : 'translate-x-1'}
                        `}
                      />
                    </button>
                    <span className={`text-xs font-medium ${product.isConverted ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {isUpdatingConversion ? '변경 중...' : (product.isConverted ? '변환 완료' : '미변환')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 수집상품 정보 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package size={18} className="text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-900">수집상품 정보</span>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">상품명</label>
                  <h1 className="text-xl font-bold text-slate-900">
                    {product.name || '(미추출)'}
                  </h1>
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
              </div>
            </div>

            {/* AI 추출 옵션/변형상품 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Layers size={18} className="text-amber-600" />
                  </div>
                  <span className="font-semibold text-slate-900">AI 추출 옵션/변형상품</span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* 옵션 그룹 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Grid3X3 size={16} className="text-slate-400" />
                    <label className="text-sm font-semibold text-slate-700">옵션</label>
                  </div>
                  {product.rawMetadata?.options && product.rawMetadata.options.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {product.rawMetadata.options.flatMap((option: { groupName: string; values: string[] }, idx: number) =>
                        option.values.map((value: string, vIdx: number) => (
                          <span
                            key={`${idx}-${vIdx}`}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium border border-amber-200"
                          >
                            {value}
                          </span>
                        ))
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">옵션 없음</p>
                  )}
                </div>

                {/* 변형상품 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers size={16} className="text-slate-400" />
                    <label className="text-sm font-semibold text-slate-700">변형상품</label>
                    {product.rawMetadata?.variants && product.rawMetadata.variants.length > 0 && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {product.rawMetadata.variants.length}개
                      </span>
                    )}
                  </div>
                  {product.rawMetadata?.variants && product.rawMetadata.variants.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left py-2.5 px-3 font-medium text-slate-600 border-b border-slate-200">옵션</th>
                            <th className="text-right py-2.5 px-3 font-medium text-slate-600 border-b border-slate-200 w-24">도매가</th>
                            <th className="text-right py-2.5 px-3 font-medium text-slate-600 border-b border-slate-200 w-24">판매가</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {product.rawMetadata.variants.map((variant: { optionSummary: string; wholesalePrice?: number; price?: number }, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 text-slate-900">
                                {variant.optionSummary || '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-600 font-medium tabular-nums">
                                {variant.wholesalePrice ? `₩${variant.wholesalePrice.toLocaleString()}` : '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700 font-medium tabular-nums">
                                {variant.price ? `₩${variant.price.toLocaleString()}` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">변형상품 없음</p>
                  )}
                </div>

                {/* 배송비 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Truck size={16} className="text-slate-400" />
                    <label className="text-sm font-semibold text-slate-700">배송비</label>
                  </div>
                  {product.rawMetadata?.shippingFee !== undefined && product.rawMetadata?.shippingFee !== null ? (
                    <p className="text-slate-900 font-medium">
                      {product.rawMetadata.shippingFee === 0 ? '무료배송' : `₩${product.rawMetadata.shippingFee.toLocaleString()}`}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">배송비 정보 없음</p>
                  )}
                </div>

                {/* 배송정보 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Truck size={16} className="text-slate-400" />
                    <label className="text-sm font-semibold text-slate-700">배송정보</label>
                  </div>
                  {product.rawMetadata?.shippingInfo ? (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                        {product.rawMetadata.shippingInfo}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">배송정보 없음</p>
                  )}
                </div>
              </div>
            </div>

            {/* 출처 게시물 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <FileText size={18} className="text-violet-600" />
                  </div>
                  <span className="font-semibold text-slate-900">출처 게시물</span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">게시물 제목</label>
                  <p className="text-slate-900 font-medium">{product.post.title}</p>
                </div>

                {product.post.author && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                      <User size={18} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">작성자</p>
                      <p className="font-medium text-slate-900">{product.post.author}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => router.push(`/post/detail/${product.post.id}`)}
                  className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-700 text-sm font-medium transition-colors"
                >
                  <ExternalLink size={16} />
                  게시물 상세 보기
                </button>
              </div>
            </div>

            {/* 변환된 상품 목록 - products 관계 제거됨 */}
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
