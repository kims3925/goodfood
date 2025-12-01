'use client'

import { useState, useEffect } from 'react'
import {
  Store,
  Search,
  RefreshCw,
  Package,
  Check,
  X,
  Send,
  Globe,
  ShoppingBag,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'

interface ShoppingMallPublish {
  publishId: number
  channelName: string
  status: string
  createdAt: string
}

interface ShopChannel {
  id: number
  name: string
  channelKey: string
  coverUrl: string | null
  isActive: boolean
}

interface Product {
  id: number
  name: string
  description: string | null
  thumbnailUrl: string | null
  price: number | null
  wholesalePrice: number | null
  stock: number
  status: string
  wholesaleBand: {
    id: number
    name: string
  } | null
  publishStatus: {
    retailBand: boolean
    shoppingMall: boolean
  }
  publishSummary: string
  shoppingMallPublish: ShoppingMallPublish | null
  createdAt: string
}

type TabType = 'unpublished' | 'published' | 'all'

export default function ShoppingMallPublishPage() {
  const toast = useToast()

  // State
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false)
  const [pendingUnpublishIds, setPendingUnpublishIds] = useState<number[]>([])

  // Shop Channels
  const [shopChannels, setShopChannels] = useState<ShopChannel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)

  // Selection
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectAllProducts, setSelectAllProducts] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('unpublished')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  // Stats (탭과 무관하게 일정한 값)
  const [stats, setStats] = useState({ total: 0, published: 0, unpublished: 0 })

  // Publish Modal
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishResult, setPublishResult] = useState<{
    success: number
    skipped: number
    failed: number
    message: string
  } | null>(null)

  // Load shop channels on mount
  useEffect(() => {
    loadShopChannels()
  }, [])

  // Load data
  useEffect(() => {
    loadProducts()
  }, [currentPage, activeTab])

  const loadShopChannels = async () => {
    try {
      setIsLoadingChannels(true)
      const response = await fetch('/api/channel?kind=RETAIL&platform=SHOP&limit=100')
      const data = await response.json()

      if (data.success) {
        const activeChannels = data.data.filter((ch: ShopChannel) => ch.isActive)
        setShopChannels(activeChannels)
        // 첫 번째 채널을 기본 선택
        if (activeChannels.length > 0 && !selectedChannelId) {
          setSelectedChannelId(activeChannels[0].id)
        }
      }
    } catch (error) {
      console.error('쇼핑몰 채널 조회 실패:', error)
    } finally {
      setIsLoadingChannels(false)
    }
  }

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        status: 'COLLECTED', // COLLECTED 상태인 상품만 조회
      })

      if (searchTerm) {
        params.append('search', searchTerm)
      }

      const response = await fetch(`/api/shop/publish?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        let filteredProducts = data.data

        // 탭에 따라 필터링 (쇼핑몰 발행 상태 기준)
        if (activeTab === 'unpublished') {
          filteredProducts = filteredProducts.filter(
            (p: any) => !p.publishStatus?.shoppingMall
          )
        } else if (activeTab === 'published') {
          filteredProducts = filteredProducts.filter(
            (p: any) => p.publishStatus?.shoppingMall
          )
        }

        setProducts(filteredProducts)
        setTotalItems(data.pagination.total)
        setTotalPages(data.pagination.totalPages)

        // 전체 통계 업데이트 (탭과 무관하게 일정)
        if (data.stats) {
          setStats(data.stats)
        }
      }
    } catch (error) {
      console.error('상품 목록 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    loadProducts()
  }

  // Selection handlers
  const handleToggleSelectAllProducts = () => {
    if (selectAllProducts) {
      setSelectedProductIds([])
      setSelectAllProducts(false)
    } else {
      const allIds = products.map((p) => p.id)
      setSelectedProductIds(allIds)
      setSelectAllProducts(true)
    }
  }

  const handleToggleProductSelection = (id: number) => {
    setSelectedProductIds((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((pid) => pid !== id)
        : [...prev, id]
      setSelectAllProducts(newSelection.length === products.length)
      return newSelection
    })
  }

  // Publish handler
  const handlePublish = async () => {
    if (selectedProductIds.length === 0) {
      return
    }

    if (!selectedChannelId) {
      alert('발행할 쇼핑몰을 선택해주세요.')
      return
    }

    setIsPublishing(true)
    setPublishResult(null)

    try {
      const response = await fetch('/api/shop/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: selectedProductIds,
          channelId: selectedChannelId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setPublishResult({
          success: data.summary.success,
          skipped: data.summary.skipped,
          failed: data.summary.failed,
          message: data.message,
        })

        // 성공 시 선택 초기화 및 목록 새로고침
        setSelectedProductIds([])
        setSelectAllProducts(false)
        loadProducts()
      } else {
        toast.error(`발행 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('발행 실패:', error)
      toast.error('발행 중 오류가 발생했습니다.')
    } finally {
      setIsPublishing(false)
    }
  }

  // Unpublish handler
  const handleUnpublish = (publishIds: number[]) => {
    setPendingUnpublishIds(publishIds)
    setShowUnpublishConfirm(true)
  }

  const confirmUnpublish = async () => {
    try {
      const response = await fetch(`/api/shop/publish?ids=${pendingUnpublishIds.join(',')}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`${data.deletedCount}개의 발행이 취소되었습니다.`)
        loadProducts()
      } else {
        toast.error(`발행 취소 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('발행 취소 실패:', error)
      toast.error('발행 취소 중 오류가 발생했습니다.')
    } finally {
      setShowUnpublishConfirm(false)
      setPendingUnpublishIds([])
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `₩${price.toLocaleString()}`
  }

  const getMarginPercent = (price: number | null, wholesalePrice: number | null) => {
    if (!price || !wholesalePrice || wholesalePrice === 0) return '-'
    const margin = ((price - wholesalePrice) / wholesalePrice) * 100
    return `${margin.toFixed(0)}%`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="text-primary-color" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">쇼핑몰 발행</h1>
          </div>
          <p className="text-gray-600">
            가공된 상품을 e-commerce 쇼핑몰에 발행합니다. 발행된 상품은 쇼핑몰 메인 페이지와 상품 상세 페이지에 표시됩니다.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">판매 가능 상품</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">발행 완료</p>
                <p className="text-2xl font-bold text-green-600">{stats.published}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="text-yellow-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">미발행 상품</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.unpublished}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Product Selection */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => {
                      setActiveTab('unpublished')
                      setCurrentPage(1)
                    }}
                    className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'unpublished'
                        ? 'border-primary-color text-primary-color'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    미발행 상품
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('published')
                      setCurrentPage(1)
                    }}
                    className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'published'
                        ? 'border-primary-color text-primary-color'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    발행 완료
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('all')
                      setCurrentPage(1)
                    }}
                    className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'all'
                        ? 'border-primary-color text-primary-color'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    전체 상품
                  </button>
                </div>
              </div>

              {/* Search & Controls */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex gap-2 flex-1 max-w-md">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <Input
                        type="text"
                        placeholder="상품명으로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="pl-10"
                      />
                    </div>
                    <Button variant="secondary" onClick={handleSearch}>
                      검색
                    </Button>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={loadProducts}
                    disabled={isLoading}
                  >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    새로고침
                  </Button>
                </div>
              </div>

              {/* Product Table */}
              {isLoading ? (
                <div className="p-12">
                  <Loading />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[5%]">
                        <input
                          type="checkbox"
                          checked={selectAllProducts}
                          onChange={handleToggleSelectAllProducts}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </TableHead>
                      <TableHead className="w-[40%]">상품명</TableHead>
                      <TableHead className="w-[12%]">도매가</TableHead>
                      <TableHead className="w-[12%]">판매가</TableHead>
                      <TableHead className="w-[8%]">마진</TableHead>
                      <TableHead className="w-[23%]">발행 상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length === 0 ? (
                      <TableEmpty
                        message={
                          activeTab === 'unpublished'
                            ? '미발행 상품이 없습니다.'
                            : activeTab === 'published'
                            ? '발행된 상품이 없습니다.'
                            : '판매중인 상품이 없습니다.'
                        }
                      />
                    ) : (
                      products.map((product) => (
                        <TableRow key={product.id} className="hover:bg-gray-50">
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(product.id)}
                              onChange={() => handleToggleProductSelection(product.id)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {product.thumbnailUrl ? (
                                <img
                                  src={product.thumbnailUrl}
                                  alt={product.name}
                                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  <Package size={20} className="text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 truncate">
                                  {product.name}
                                </div>
                                {product.wholesaleBand && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {product.wholesaleBand.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-600">
                              {formatPrice(product.wholesalePrice)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-gray-900">
                              {formatPrice(product.price)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-green-600 font-medium">
                              {getMarginPercent(product.price, product.wholesalePrice)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {product.publishStatus?.shoppingMall ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                                  <Globe size={12} />
                                  발행완료
                                </span>
                                {product.shoppingMallPublish && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUnpublish([product.shoppingMallPublish!.publishId])
                                    }}
                                    className="text-gray-400 hover:text-red-600"
                                    title="발행 취소"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">미발행</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>

          {/* Right: Publish Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Shop Channel Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Store className="text-primary-color" size={20} />
                <h3 className="font-semibold text-gray-900">쇼핑몰 선택</h3>
              </div>

              {isLoadingChannels ? (
                <div className="py-4 text-center text-gray-500 text-sm">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />
                  채널 로딩 중...
                </div>
              ) : shopChannels.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-gray-500 text-sm mb-3">
                    등록된 쇼핑몰이 없습니다.
                  </p>
                  <a
                    href="/channel"
                    className="text-primary-color text-sm font-medium hover:underline"
                  >
                    채널 관리에서 쇼핑몰 등록하기
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {shopChannels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannelId(channel.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        selectedChannelId === channel.id
                          ? 'border-primary-color bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {channel.coverUrl ? (
                        <img
                          src={channel.coverUrl}
                          alt={channel.name}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Store size={20} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900 text-sm">
                          {channel.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {channel.channelKey}
                        </div>
                      </div>
                      {selectedChannelId === channel.id && (
                        <CheckCircle size={20} className="text-primary-color flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Publish Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="text-primary-color" size={20} />
                <h3 className="font-semibold text-gray-900">발행 정보</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">발행 대상</span>
                  <span className="font-medium">
                    {selectedChannelId
                      ? shopChannels.find((c) => c.id === selectedChannelId)?.name || '-'
                      : '미선택'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">선택한 상품</span>
                  <span className="font-medium">{selectedProductIds.length}개</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-700 font-medium">발행 예정</span>
                    <span className="font-bold text-primary-color">
                      {selectedProductIds.length}건
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                선택한 상품이 지정한 쇼핑몰에 발행됩니다.
              </p>
            </div>

            {/* Publish Button */}
            <Button
              variant="primary"
              className="w-full py-3"
              onClick={handlePublish}
              disabled={selectedProductIds.length === 0 || !selectedChannelId || isPublishing}
            >
              {isPublishing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  발행 중...
                </>
              ) : (
                <>
                  <Send size={16} />
                  쇼핑몰에 발행하기
                </>
              )}
            </Button>

            {/* Publish Result */}
            {publishResult && (
              <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-green-600" size={20} />
                  <h4 className="font-medium text-green-900">발행 완료</h4>
                </div>
                <p className="text-sm text-green-700 mb-2">{publishResult.message}</p>
                <div className="text-xs text-green-600 space-y-1">
                  <p>성공: {publishResult.success}건</p>
                  {publishResult.skipped > 0 && <p>건너뜀: {publishResult.skipped}건</p>}
                  {publishResult.failed > 0 && <p>실패: {publishResult.failed}건</p>}
                </div>
              </div>
            )}

            {/* E-commerce Link */}
            <a
              href="http://localhost:3000/store"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <ExternalLink size={16} />
              쇼핑몰 미리보기
            </a>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <ShoppingBag size={20} />
            쇼핑몰 발행 안내
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <Check size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                <strong>독립적 발행:</strong> 쇼핑몰 발행은 소매밴드 발행과 독립적으로 관리됩니다.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                <strong>상품 데이터 동기화:</strong> 발행된 상품의 이름, 설명, 이미지, 가격이 e-commerce 쇼핑몰에 표시됩니다.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                <strong>재고 및 가격 동기화:</strong> sourcing-app에서 수정한 가격과 재고 정보가 쇼핑몰에 즉시 반영됩니다.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                <strong>중복 발행 방지:</strong> 이미 쇼핑몰에 발행된 상품은 자동으로 건너뜁니다.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* 발행 취소 확인 모달 */}
      <ConfirmModal
        isOpen={showUnpublishConfirm}
        onClose={() => {
          setShowUnpublishConfirm(false)
          setPendingUnpublishIds([])
        }}
        onConfirm={confirmUnpublish}
        title="발행 취소"
        message="선택한 발행을 취소하시겠습니까?"
        confirmText="발행 취소"
        variant="danger"
      />
    </div>
  )
}
