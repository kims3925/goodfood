'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Store, Trash2, Pencil, X, Save, ImageIcon, Package, Calendar, Globe, History, DollarSign, Clock, AlertCircle, CheckCircle } from 'lucide-react'
// Pencil, X, Save는 상품 정보 편집에서 사용됨
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import ProductImageViewer from '@/components/ui/ProductImageViewer'

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
          url: string
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
    description: '',
  })
  const [originalForm, setOriginalForm] = useState({
    name: '',
    description: '',
  })


  const loadProduct = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/published-product/${id}`)
      const data = await response.json()

      if (data.success) {
        setProduct(data.data)
        const formData = {
          name: data.data.product.name || '',
          description: data.data.product.description || '',
        }
        setEditForm(formData)
        setOriginalForm(formData)
        setProductChanged(false)
        setIsEditingProduct(false)
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

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return '-'
    return `₩${price.toLocaleString()}`
  }

  // variant에서 대표 가격 추출
  const getMainPrice = () => {
    return product?.product?.variants?.[0]?.price ?? null
  }

  const startEditingProduct = () => {
    setIsEditingProduct(true)
    setProductChanged(false)
  }

  const cancelEditingProduct = () => {
    setEditForm(originalForm)
    setProductChanged(false)
    setIsEditingProduct(false)
  }

  const handleFormChange = (field: string, value: string) => {
    const newForm = { ...editForm, [field]: value }
    setEditForm(newForm)
    const hasChanged =
      newForm.name !== originalForm.name ||
      newForm.description !== originalForm.description
    setProductChanged(hasChanged)
  }

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
          description: editForm.description || null,
        }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success('상품 정보가 저장되었습니다.')
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

  const getHistoryStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; bgColor: string; textColor: string; dotColor: string; icon: typeof CheckCircle } } = {
      SUCCESS: { label: '발행 성공', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', dotColor: 'bg-emerald-500', icon: CheckCircle },
      FAILED: { label: '발행 실패', bgColor: 'bg-red-50', textColor: 'text-red-700', dotColor: 'bg-red-500', icon: AlertCircle },
      PENDING: { label: '발행 대기', bgColor: 'bg-amber-50', textColor: 'text-amber-700', dotColor: 'bg-amber-500', icon: Clock },
    }
    const statusInfo = statusMap[status] || { label: status, bgColor: 'bg-slate-100', textColor: 'text-slate-700', dotColor: 'bg-slate-500', icon: Clock }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.textColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`}></span>
        {statusInfo.label}
      </span>
    )
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

  const galleryImages = product.product.collectedProduct?.post?.images ?? []

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
                  {product.product.name}
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
                      productName={product.product.name}
                      enableLightbox={true}
                      showThumbnails={true}
                      thumbnailSize="md"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <ImageIcon size={48} className="mb-2" />
                      <p className="text-sm">이미지가 없습니다</p>
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
                </div>
              </div>

              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    {product.channel?.coverUrl ? (
                      <img
                        src={product.channel.coverUrl}
                        alt={product.channel.name}
                        className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                        <Store size={24} className="text-slate-500" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-slate-500">발행 채널</p>
                      <p className="font-semibold text-slate-900">{product.channel?.name || '쇼핑몰'}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    {product.channel?.platform || 'SHOP'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
                      <Calendar size={18} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">발행일시</p>
                      <p className="font-medium text-slate-900">
                        {product.publishedAt
                          ? new Date(product.publishedAt).toLocaleString('ko-KR')
                          : '-'}
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
                        {new Date(product.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 상품 정보 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Package size={18} className="text-blue-600" />
                    </div>
                    <span className="font-semibold text-slate-900">상품 정보</span>
                  </div>
                  {isEditingProduct ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={cancelEditingProduct}>
                        <X size={14} />
                        취소
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveProduct}
                        disabled={!productChanged || isSavingProduct || !editForm.name}
                      >
                        <Save size={14} />
                        {isSavingProduct ? '저장중...' : '저장'}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={startEditingProduct}>
                      <Pencil size={14} />
                      수정
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {isEditingProduct ? (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">상품명</label>
                      <Input
                        value={editForm.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        placeholder="상품명을 입력하세요"
                        className="!rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">설명</label>
                      <textarea
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={6}
                        value={editForm.description}
                        onChange={(e) => handleFormChange('description', e.target.value)}
                        placeholder="상품 설명을 입력하세요"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">상품명</label>
                      <h1 className="text-xl font-bold text-slate-900">{product.product.name}</h1>
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

                    {product.product.description && (
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

            {/* 발행 이력 카드 */}
            {product.publishHistories.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-violet-100 rounded-lg">
                      <History size={18} className="text-violet-600" />
                    </div>
                    <span className="font-semibold text-slate-900">발행 이력</span>
                    <span className="px-2 py-0.5 bg-slate-200 rounded-full text-xs font-medium text-slate-600">
                      {product.publishHistories.length}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="space-y-3">
                    {product.publishHistories.map((history) => (
                      <div
                        key={history.id}
                        className="group relative bg-gradient-to-r from-slate-50 to-white p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              history.status === 'SUCCESS' ? 'bg-emerald-100' :
                              history.status === 'FAILED' ? 'bg-red-100' : 'bg-amber-100'
                            }`}>
                              {history.status === 'SUCCESS' && <CheckCircle size={20} className="text-emerald-600" />}
                              {history.status === 'FAILED' && <AlertCircle size={20} className="text-red-600" />}
                              {history.status === 'PENDING' && <Clock size={20} className="text-amber-600" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {getHistoryStatusBadge(history.status)}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Calendar size={14} />
                                {new Date(history.publishedAt).toLocaleString('ko-KR')}
                              </div>
                            </div>
                          </div>
                        </div>
                        {history.errorMessage && (
                          <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
                            <p className="text-sm text-red-700">{history.errorMessage}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
