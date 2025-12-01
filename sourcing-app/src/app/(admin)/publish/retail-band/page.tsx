'use client'

import { useState, useEffect } from 'react'
import { Send, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Image as ImageIcon, MessageSquare, Filter, Zap } from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import Modal, { ModalFooter } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

interface RetailBand {
  id: number
  name: string
  bandKey: string
  coverUrl: string | null
  isActive: boolean
}

interface Product {
  id: number
  name: string
  description: string | null
  price: number | null
  wholesalePrice: number | null
  thumbnailUrl: string | null
  publishedRetailBandIds: number[] // 발행된 소매밴드 ID 목록
  post: {
    id: number
    title: string
    content: string
    images: Array<{ imageUrl: string }>
    comments: Array<{ author: string; content: string }>
  }
}

export default function RetailBandPublishPage() {
  const toast = useToast()

  // 상태 관리
  const [retailBands, setRetailBands] = useState<RetailBand[]>([])
  const [selectedBandIds, setSelectedBandIds] = useState<number[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)
  const [expandedProductIds, setExpandedProductIds] = useState<number[]>([])

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  // 필터 상태
  const [showOnlyUnpublished, setShowOnlyUnpublished] = useState(false)

  // 발행 결과
  const [publishResults, setPublishResults] = useState<Array<{
    bandId: number
    bandName: string
    productId: number
    productName: string
    success: boolean
    skipped?: boolean
    error?: string
  }>>([])
  const [showResultModal, setShowResultModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{
    // 상품 기준 분류
    allNewProducts: Array<{ id: number; name: string }>      // 모든 밴드에 미발행
    partialProducts: Array<{ id: number; name: string; publishedBands: string[]; unpublishedBands: string[] }> // 일부만 발행
    allPublishedProducts: Array<{ id: number; name: string }> // 모든 밴드에 이미 발행됨
    // 발행 건수 기준
    newPublishCount: number   // 신규 발행 예정 건수
    skipCount: number         // 스킵 예정 건수
    totalCount: number        // 전체 건수
  } | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setIsLoading(true)
    try {
      // 소매밴드 목록 조회
      const bandsRes = await fetch('/api/band/retail')
      const bandsData = await bandsRes.json()
      if (bandsData.success) {
        const activeBands = bandsData.data.filter((b: RetailBand) => b.isActive)
        setRetailBands(activeBands)
      }

      // 발행 가능한 상품 목록 조회
      await loadProducts()
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error)
      toast.error('데이터를 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const loadProducts = async (page: number = 1) => {
    try {
      // 수집(COLLECTED) 상태의 상품 조회
      const res = await fetch(`/api/product?page=${page}&limit=${pageSize}&status=COLLECTED`)
      const data = await res.json()
      if (data.success) {
        setProducts(data.data)
        setTotalProducts(data.total || 0)
        setTotalPages(Math.ceil((data.total || 0) / pageSize))
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('상품 목록 조회 실패:', error)
      toast.error('상품 목록을 불러오는데 실패했습니다.')
    }
  }

  const handleToggleProductSelection = (productId: number) => {
    setSelectedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const handleToggleSelectAll = () => {
    const visibleProducts = getFilteredProducts()
    if (selectedProductIds.length === visibleProducts.length) {
      setSelectedProductIds([])
    } else {
      setSelectedProductIds(visibleProducts.map(p => p.id))
    }
  }

  // 선택한 밴드에 발행되지 않은 상품 필터링
  const getFilteredProducts = () => {
    if (!showOnlyUnpublished || selectedBandIds.length === 0) {
      return products
    }
    // 선택한 밴드 중 하나라도 미발행인 상품만 표시
    return products.filter(product => {
      const publishedIds = product.publishedRetailBandIds || []
      return selectedBandIds.some(bandId => !publishedIds.includes(bandId))
    })
  }

  // 미발행 상품만 선택
  const handleSelectOnlyUnpublished = () => {
    if (selectedBandIds.length === 0) return

    const unpublishedProductIds = products
      .filter(product => {
        const publishedIds = product.publishedRetailBandIds || []
        return selectedBandIds.some(bandId => !publishedIds.includes(bandId))
      })
      .map(p => p.id)

    setSelectedProductIds(unpublishedProductIds)
  }

  // 상품이 특정 밴드에 발행되었는지 확인
  const isPublishedToBand = (product: Product, bandId: number) => {
    return (product.publishedRetailBandIds || []).includes(bandId)
  }

  // 상품의 발행 현황 계산
  const getPublishStats = (product: Product) => {
    const publishedCount = (product.publishedRetailBandIds || []).filter(
      id => retailBands.some(b => b.id === id)
    ).length
    return {
      published: publishedCount,
      total: retailBands.length,
    }
  }

  // 중복 발행 체크 - 상품 기준 분류
  const checkDuplicates = () => {
    const allNewProducts: Array<{ id: number; name: string }> = []
    const partialProducts: Array<{ id: number; name: string; publishedBands: string[]; unpublishedBands: string[] }> = []
    const allPublishedProducts: Array<{ id: number; name: string }> = []

    let newPublishCount = 0
    let skipCount = 0
    const totalCount = selectedProductIds.length * selectedBandIds.length

    selectedProductIds.forEach(productId => {
      const product = products.find(p => p.id === productId)
      if (!product) return

      const publishedIds = product.publishedRetailBandIds || []
      const publishedBandIds = selectedBandIds.filter(bandId => publishedIds.includes(bandId))
      const unpublishedBandIds = selectedBandIds.filter(bandId => !publishedIds.includes(bandId))

      newPublishCount += unpublishedBandIds.length
      skipCount += publishedBandIds.length

      // 상품 분류
      if (publishedBandIds.length === 0) {
        // 모든 밴드에 미발행
        allNewProducts.push({ id: product.id, name: product.name })
      } else if (unpublishedBandIds.length === 0) {
        // 모든 밴드에 이미 발행됨
        allPublishedProducts.push({ id: product.id, name: product.name })
      } else {
        // 일부만 발행됨
        const publishedBandNames = publishedBandIds
          .map(id => retailBands.find(b => b.id === id)?.name)
          .filter((name): name is string => !!name)
        const unpublishedBandNames = unpublishedBandIds
          .map(id => retailBands.find(b => b.id === id)?.name)
          .filter((name): name is string => !!name)

        partialProducts.push({
          id: product.id,
          name: product.name,
          publishedBands: publishedBandNames,
          unpublishedBands: unpublishedBandNames,
        })
      }
    })

    return {
      allNewProducts,
      partialProducts,
      allPublishedProducts,
      newPublishCount,
      skipCount,
      totalCount,
    }
  }

  const handleToggleExpand = (productId: number) => {
    setExpandedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const handleToggleBandSelection = (bandId: number) => {
    setSelectedBandIds(prev =>
      prev.includes(bandId)
        ? prev.filter(id => id !== bandId)
        : [...prev, bandId]
    )
  }

  const handleToggleSelectAllBands = () => {
    if (selectedBandIds.length === retailBands.length) {
      setSelectedBandIds([])
    } else {
      setSelectedBandIds(retailBands.map(b => b.id))
    }
  }

  // 발행 버튼 클릭 시 - 중복 체크 후 확인 모달 표시
  const handlePublishClick = () => {
    if (selectedBandIds.length === 0 || selectedProductIds.length === 0) {
      return
    }

    const info = checkDuplicates()
    setDuplicateInfo(info)
    setShowConfirmModal(true)
  }

  // 실제 발행 실행
  const handlePublish = async (skipDuplicates: boolean) => {
    setShowConfirmModal(false)
    setIsPublishing(true)
    setPublishResults([])

    try {
      const res = await fetch('/api/publish/retail-band', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailBandIds: selectedBandIds,
          productIds: selectedProductIds,
          skipDuplicates, // 중복 스킵 여부
        }),
      })
      const data = await res.json()

      if (data.success) {
        setPublishResults(data.results)
        setShowResultModal(true)
        setSelectedProductIds([])
        loadProducts(currentPage)

        const successCount = data.results.filter((r: { success: boolean }) => r.success).length
        if (successCount > 0) {
          toast.success(`${successCount}건 발행 완료`)
        }
      } else {
        toast.error('발행에 실패했습니다.')
      }
    } catch (error) {
      console.error('발행 실패:', error)
      toast.error('발행 중 오류가 발생했습니다.')
    } finally {
      setIsPublishing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">소매밴드 발행</h1>
          <p className="text-gray-600">
            가공된 상품을 소매밴드에 게시글로 발행합니다. 각 밴드에 설정된 주문서 URL이 댓글로 등록됩니다.
          </p>
        </div>

        {/* 소매밴드 선택 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">발행할 소매밴드 선택</h2>
            {retailBands.length > 0 && (
              <span className="text-sm text-gray-500">
                {selectedBandIds.length}개 선택됨
              </span>
            )}
          </div>

          {retailBands.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto text-yellow-500 mb-2" size={48} />
              <p className="text-gray-600">등록된 소매밴드가 없습니다.</p>
              <p className="text-sm text-gray-500 mt-1">밴드관리 &gt; 소매밴드 관리에서 밴드를 먼저 등록해주세요.</p>
            </div>
          ) : (
            <>
              {/* 전체 선택 */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                <input
                  type="checkbox"
                  checked={selectedBandIds.length === retailBands.length && retailBands.length > 0}
                  onChange={handleToggleSelectAllBands}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">
                  전체 선택 ({selectedBandIds.length}/{retailBands.length})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {retailBands.map(band => {
                  const isSelected = selectedBandIds.includes(band.id)
                  return (
                    <button
                      key={band.id}
                      onClick={() => handleToggleBandSelection(band.id)}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                        ${isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleBandSelection(band.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 flex-shrink-0"
                      />
                      {band.coverUrl ? (
                        <img
                          src={band.coverUrl}
                          alt={band.name}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-400 text-xs">No</span>
                        </div>
                      )}
                      <p className="font-medium text-gray-900 text-left truncate">{band.name}</p>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* 발행할 상품 목록 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-900">발행할 상품 선택</h2>
                <span className="text-sm text-gray-500">
                  (전체 {totalProducts}개)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => loadProducts(currentPage)}
                >
                  <RefreshCw size={16} />
                  새로고침
                </Button>
                <Button
                  variant="primary"
                  onClick={handlePublishClick}
                  disabled={isPublishing || selectedProductIds.length === 0 || selectedBandIds.length === 0}
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      발행 중...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      선택 발행 ({selectedProductIds.length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto text-yellow-500 mb-2" size={48} />
              <p className="text-gray-600">발행 가능한 상품이 없습니다.</p>
              <p className="text-sm text-gray-500 mt-1">상품 관리에서 상품을 먼저 생성해주세요.</p>
            </div>
          ) : (
            <div className="p-4">
              {/* 전체 선택 + 필터 옵션 */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.length === getFilteredProducts().length && getFilteredProducts().length > 0}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      전체 선택 ({selectedProductIds.length}/{getFilteredProducts().length})
                    </span>
                  </div>

                  {/* 미발행 필터 토글 */}
                  {selectedBandIds.length > 0 && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showOnlyUnpublished}
                        onChange={(e) => setShowOnlyUnpublished(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <Filter size={14} className="text-gray-500" />
                      <span className="text-gray-600">미발행만 표시</span>
                    </label>
                  )}
                </div>

                {/* 미발행 상품만 선택 버튼 */}
                {selectedBandIds.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSelectOnlyUnpublished}
                    className="text-blue-600"
                  >
                    <Zap size={14} />
                    미발행만 선택
                  </Button>
                )}
              </div>

              {/* 상품 목록 */}
              <div className="space-y-3">
                {getFilteredProducts().map(product => {
                  const isExpanded = expandedProductIds.includes(product.id)
                  const isSelected = selectedProductIds.includes(product.id)
                  const publishStats = getPublishStats(product)

                  return (
                    <div
                      key={product.id}
                      className={`
                        border rounded-lg transition-all
                        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                      `}
                    >
                      {/* 상품 기본 정보 */}
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleToggleExpand(product.id)}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleToggleProductSelection(product.id)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4"
                          />

                          {/* 썸네일 */}
                          {product.thumbnailUrl ? (
                            <img
                              src={product.thumbnailUrl}
                              alt={product.name}
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="text-gray-400" size={24} />
                            </div>
                          )}

                          {/* 상품 정보 */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                            <div className="flex items-center gap-4 mt-1">
                              {product.price && (
                                <span className="text-sm font-semibold text-blue-600">
                                  {product.price.toLocaleString()}원
                                </span>
                              )}
                              {product.wholesalePrice && (
                                <span className="text-sm text-gray-500">
                                  도매가: {product.wholesalePrice.toLocaleString()}원
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <ImageIcon size={12} />
                                {product.post?.images?.length || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare size={12} />
                                {product.post?.comments?.length || 0}
                              </span>
                              {/* 발행 현황 */}
                              {retailBands.length > 0 && (
                                <span
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                                    publishStats.published === 0
                                      ? 'bg-gray-100 text-gray-600'
                                      : publishStats.published === publishStats.total
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                >
                                  <Send size={10} />
                                  {publishStats.published}/{publishStats.total} 발행
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 확장 아이콘 */}
                          {isExpanded ? (
                            <ChevronDown className="text-gray-400" size={20} />
                          ) : (
                            <ChevronRight className="text-gray-400" size={20} />
                          )}
                        </div>
                      </div>

                      {/* 상품 상세 정보 (확장 시) */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-gray-200">
                          <div className="ml-8 space-y-3">
                            {/* 설명 */}
                            {product.description && (
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">상품 설명</label>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {product.description}
                                </p>
                              </div>
                            )}

                            {/* 이미지 */}
                            {product.post?.images && product.post.images.length > 0 && (
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">이미지</label>
                                <div className="flex gap-2 overflow-x-auto">
                                  {product.post.images.slice(0, 6).map((img, idx) => (
                                    <img
                                      key={idx}
                                      src={img.imageUrl}
                                      alt={`이미지 ${idx + 1}`}
                                      className="w-20 h-20 rounded object-cover flex-shrink-0"
                                    />
                                  ))}
                                  {product.post.images.length > 6 && (
                                    <div className="w-20 h-20 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs text-gray-600">
                                        +{product.post.images.length - 6}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 페이징 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => loadProducts(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    이전
                  </Button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages} 페이지
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => loadProducts(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    다음
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 발행 확인 모달 (중복 경고) */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="발행 확인"
        size="md"
      >
        {duplicateInfo && (
          <div className="space-y-4">
            {/* 상단 요약 */}
            <div className="text-center py-2 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                선택한 <span className="font-bold text-gray-900">{selectedProductIds.length}개</span> 상품 →{' '}
                <span className="font-bold text-gray-900">{selectedBandIds.length}개</span> 밴드에 발행
              </p>
            </div>

            {/* 상품 분류 카드 */}
            <div className="space-y-2">
              {/* 모두 신규 */}
              {duplicateInfo.allNewProducts.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🆕</span>
                    <span className="text-sm font-medium text-blue-800">모두 신규</span>
                    <span className="text-xs text-blue-600">(전체 밴드 미발행)</span>
                  </div>
                  <span className="text-lg font-bold text-blue-700">{duplicateInfo.allNewProducts.length}개</span>
                </div>
              )}

              {/* 일부 중복 */}
              {duplicateInfo.partialProducts.length > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔶</span>
                      <span className="text-sm font-medium text-yellow-800">일부 중복</span>
                      <span className="text-xs text-yellow-600">(일부 밴드만 발행됨)</span>
                    </div>
                    <span className="text-lg font-bold text-yellow-700">{duplicateInfo.partialProducts.length}개</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 ml-7">
                    {duplicateInfo.partialProducts.slice(0, 3).map((p, idx) => (
                      <div key={idx} className="text-xs text-yellow-700">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-yellow-500 ml-1">
                          - 발행됨: {p.publishedBands.join(', ')}
                        </span>
                      </div>
                    ))}
                    {duplicateInfo.partialProducts.length > 3 && (
                      <p className="text-xs text-yellow-500">외 {duplicateInfo.partialProducts.length - 3}개...</p>
                    )}
                  </div>
                </div>
              )}

              {/* 모두 발행됨 */}
              {duplicateInfo.allPublishedProducts.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-lg opacity-50">✅</span>
                    <span className="text-sm font-medium text-gray-400">모두 발행됨</span>
                    <span className="text-xs text-gray-400">(전체 밴드 발행 완료)</span>
                  </div>
                  <span className="text-lg font-bold text-gray-400">{duplicateInfo.allPublishedProducts.length}개</span>
                </div>
              )}
            </div>

            {/* 발행 건수 요약 */}
            <div className="flex items-center justify-center gap-6 py-3 border-t border-gray-200">
              <div className="text-center">
                <p className="text-xl font-bold text-green-600">{duplicateInfo.newPublishCount}</p>
                <p className="text-xs text-gray-500">발행 예정</p>
              </div>
              <div className="text-gray-300">/</div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-400">{duplicateInfo.skipCount}</p>
                <p className="text-xs text-gray-500">스킵 예정</p>
              </div>
            </div>

            {duplicateInfo.newPublishCount === 0 && (
              <p className="text-sm text-gray-500 text-center">
                모든 상품이 이미 발행되었습니다.
              </p>
            )}
          </div>
        )}

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            취소
          </Button>
          {duplicateInfo && duplicateInfo.newPublishCount > 0 && (
            <Button variant="primary" onClick={() => handlePublish(true)}>
              <Zap size={16} />
              미발행만 진행 ({duplicateInfo.newPublishCount}건)
            </Button>
          )}
          {duplicateInfo && duplicateInfo.skipCount > 0 && duplicateInfo.newPublishCount > 0 && (
            <Button
              variant="secondary"
              onClick={() => handlePublish(false)}
              className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
            >
              전체 재발행
            </Button>
          )}
          {duplicateInfo && duplicateInfo.skipCount === 0 && (
            <Button variant="primary" onClick={() => handlePublish(false)}>
              <Send size={16} />
              발행하기
            </Button>
          )}
        </ModalFooter>
      </Modal>

      {/* 발행 결과 모달 */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title="발행 결과"
        size="md"
      >
        {/* 결과 요약 */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 p-3 bg-green-50 rounded-lg text-center">
            <p className="text-xl font-bold text-green-600">
              {publishResults.filter(r => r.success).length}
            </p>
            <p className="text-xs text-green-700">성공</p>
          </div>
          <div className="flex-1 p-3 bg-gray-50 rounded-lg text-center">
            <p className="text-xl font-bold text-gray-500">
              {publishResults.filter(r => r.skipped).length}
            </p>
            <p className="text-xs text-gray-600">스킵</p>
          </div>
          <div className="flex-1 p-3 bg-red-50 rounded-lg text-center">
            <p className="text-xl font-bold text-red-600">
              {publishResults.filter(r => !r.success && !r.skipped).length}
            </p>
            <p className="text-xs text-red-700">실패</p>
          </div>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {publishResults.map((result, idx) => (
            <div
              key={idx}
              className={`
                flex items-center gap-3 p-3 rounded-lg
                ${result.success ? 'bg-green-50' : result.skipped ? 'bg-gray-50' : 'bg-red-50'}
              `}
            >
              {result.success ? (
                <CheckCircle2 className="text-green-500 flex-shrink-0" size={18} />
              ) : result.skipped ? (
                <AlertCircle className="text-gray-400 flex-shrink-0" size={18} />
              ) : (
                <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  result.success ? 'text-green-700' : result.skipped ? 'text-gray-500' : 'text-red-700'
                }`}>
                  {result.productName}
                </p>
                <p className="text-xs text-gray-500">
                  → {result.bandName}
                  {result.skipped && <span className="ml-1">(이미 발행됨)</span>}
                </p>
                {result.error && (
                  <p className="text-xs text-red-600 mt-1">{result.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <ModalFooter>
          <Button variant="primary" onClick={() => setShowResultModal(false)}>
            확인
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
