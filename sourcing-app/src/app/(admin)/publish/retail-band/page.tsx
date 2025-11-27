'use client'

import { useState, useEffect } from 'react'
import { Send, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Image as ImageIcon, MessageSquare } from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import Modal, { ModalFooter } from '@/components/ui/Modal'

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
  post: {
    id: number
    title: string
    content: string
    images: Array<{ imageUrl: string }>
    comments: Array<{ author: string; content: string }>
  }
}

export default function RetailBandPublishPage() {
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

  // 발행 결과
  const [publishResults, setPublishResults] = useState<Array<{
    bandId: number
    bandName: string
    productId: number
    productName: string
    success: boolean
    error?: string
  }>>([])
  const [showResultModal, setShowResultModal] = useState(false)

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
    } finally {
      setIsLoading(false)
    }
  }

  const loadProducts = async (page: number = 1) => {
    try {
      const res = await fetch(`/api/product?page=${page}&limit=${pageSize}`)
      const data = await res.json()
      if (data.success) {
        setProducts(data.data)
        setTotalProducts(data.total || 0)
        setTotalPages(Math.ceil((data.total || 0) / pageSize))
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('상품 목록 조회 실패:', error)
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
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([])
    } else {
      setSelectedProductIds(products.map(p => p.id))
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

  const handleOpenSettingModal = () => {
    setTempSetting({ ...publishSetting })
    setShowSettingModal(true)
  }

  const handleSaveSetting = async () => {
    try {
      const res = await fetch('/api/settings/publish', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tempSetting),
      })
      const data = await res.json()
      if (data.success) {
        setPublishSetting(tempSetting)
        setShowSettingModal(false)
      }
    } catch (error) {
      console.error('설정 저장 실패:', error)
    }
  }

  const handlePublish = async () => {
    if (selectedBandIds.length === 0 || selectedProductIds.length === 0) {
      return
    }

    const selectedBandNames = retailBands
      .filter(b => selectedBandIds.includes(b.id))
      .map(b => b.name)
      .join(', ')

    if (!confirm(`선택한 ${selectedProductIds.length}개 상품을 ${selectedBandIds.length}개 밴드(${selectedBandNames})에 발행하시겠습니까?`)) {
      return
    }

    setIsPublishing(true)
    setPublishResults([])

    try {
      const res = await fetch('/api/publish/retail-band', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailBandIds: selectedBandIds,
          productIds: selectedProductIds,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setPublishResults(data.results)
        setShowResultModal(true)
        setSelectedProductIds([])
        loadProducts(currentPage)
      }
    } catch (error) {
      console.error('발행 실패:', error)
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
                  onClick={handlePublish}
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
              {/* 전체 선택 */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                <input
                  type="checkbox"
                  checked={selectedProductIds.length === products.length}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">
                  전체 선택 ({selectedProductIds.length}/{products.length})
                </span>
              </div>

              {/* 상품 목록 */}
              <div className="space-y-3">
                {products.map(product => {
                  const isExpanded = expandedProductIds.includes(product.id)
                  const isSelected = selectedProductIds.includes(product.id)

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
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <ImageIcon size={12} />
                                {product.post?.images?.length || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare size={12} />
                                {product.post?.comments?.length || 0}
                              </span>
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

      {/* 발행 결과 모달 */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title="발행 결과"
        size="md"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {publishResults.map((result, idx) => (
            <div
              key={idx}
              className={`
                flex items-center gap-3 p-3 rounded-lg
                ${result.success ? 'bg-green-50' : 'bg-red-50'}
              `}
            >
              {result.success ? (
                <CheckCircle2 className="text-green-500 flex-shrink-0" size={20} />
              ) : (
                <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.productName}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  → {result.bandName}
                </p>
                {result.error && (
                  <p className="text-sm text-red-600 mt-1">{result.error}</p>
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
