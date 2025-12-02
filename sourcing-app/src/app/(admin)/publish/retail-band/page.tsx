'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Store,
  Search,
  RefreshCw,
  Package,
  Check,
  X,
  Send,
  Globe,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'

interface Channel {
  id: number
  name: string
  channelKey: string
  coverUrl: string | null
  platform?: string | null
  isActive: boolean
}

interface PublishedChannel {
  publishId: number
  channelId: number | null
  channelName: string | null
  status: string
  createdAt: string
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
  publishStatus: {
    channel: boolean
    shoppingMall: boolean
    retailBand: boolean
  }
  publishSummary: string
  publishedChannels: PublishedChannel[]
  createdAt: string
}

type TabType = 'unpublished' | 'published' | 'all'

export default function RetailBandPublishPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)

  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)

  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectAllProducts, setSelectAllProducts] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('unpublished')

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  const [publishResult, setPublishResult] = useState<{
    success: number
    skipped: number
    failed: number
    message: string
  } | null>(null)

  useEffect(() => {
    loadChannels()
  }, [])

  useEffect(() => {
    loadProducts()
  }, [currentPage, activeTab, selectedChannelId])

  const loadChannels = async () => {
    try {
      setIsLoadingChannels(true)
      const response = await fetch('/api/channel?kind=RETAIL&limit=100')
      const data = await response.json()

      if (data.success) {
        const retailChannels = (data.data as Channel[]).filter((ch) => ch.platform !== 'SHOP' && ch.isActive)
        setChannels(retailChannels)
        if (retailChannels.length > 0 && !selectedChannelId) {
          setSelectedChannelId(retailChannels[0].id)
        }
      }
    } catch (error) {
      console.error('소매채널 조회 실패:', error)
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
      })

      if (searchTerm) {
        params.append('search', searchTerm)
      }

      const response = await fetch(`/api/shop/publish?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        let filteredProducts: Product[] = data.data

        if (activeTab === 'unpublished') {
          filteredProducts = filteredProducts.filter((p) => !isPublishedOnSelectedChannel(p))
        } else if (activeTab === 'published') {
          filteredProducts = filteredProducts.filter((p) => isPublishedOnSelectedChannel(p))
        }

        setProducts(filteredProducts)
        setTotalItems(data.pagination.total)
        setTotalPages(data.pagination.totalPages)
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

  const isPublishedOnSelectedChannel = (product: Product) => {
    if (!selectedChannelId) return false
    return product.publishedChannels?.some((pc) => pc.channelId === selectedChannelId)
  }

  const getPublishIdForSelectedChannel = (product: Product) => {
    if (!selectedChannelId) return null
    const matched = product.publishedChannels?.find((pc) => pc.channelId === selectedChannelId)
    return matched?.publishId || null
  }

  const handlePublish = async () => {
    if (selectedProductIds.length === 0 || !selectedChannelId) {
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

        setSelectedProductIds([])
        setSelectAllProducts(false)
        loadProducts()
      } else {
        alert(`발행 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('발행 실패:', error)
      alert('발행 중 오류가 발생했습니다.')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleUnpublish = async (publishIds: number[]) => {
    if (publishIds.length === 0) return
    if (!confirm('선택한 발행을 취소하시겠습니까?')) return

    try {
      const response = await fetch(`/api/shop/publish?ids=${publishIds.join(',')}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        alert(`${data.deletedCount}개의 발행이 취소되었습니다.`)
        loadProducts()
      } else {
        alert(`발행 취소 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('발행 취소 실패:', error)
      alert('발행 취소 중 오류가 발생했습니다.')
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

  const unpublishedCount = products.filter((p) => !isPublishedOnSelectedChannel(p)).length
  const publishedCount = products.filter((p) => isPublishedOnSelectedChannel(p)).length

  const selectedChannel = useMemo(
    () => channels.find((ch) => ch.id === selectedChannelId) || null,
    [channels, selectedChannelId]
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Store className="text-primary-color" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">소매밴드 발행</h1>
          </div>
          <p className="text-gray-600">
            소매 채널(밴드, 카페 등)에 상품을 발행합니다. 채널을 선택하고 원하는 상품을 일괄 발행하세요.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">판매 가능 상품</p>
                <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
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
                <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
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
                <p className="text-2xl font-bold text-yellow-600">{unpublishedCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
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
                    미발행
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
                    전체
                  </button>
                </div>
              </div>

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
                      products.map((product) => {
                        const publishId = getPublishIdForSelectedChannel(product)
                        return (
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
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {product.publishSummary}
                                  </div>
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
                              {publishId ? (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                                    <Globe size={12} />
                                    발행완료
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUnpublish([publishId])
                                    }}
                                    className="text-gray-400 hover:text-red-600"
                                    title="발행 취소"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">미발행</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              )}

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Store className="text-primary-color" size={20} />
                <h3 className="font-semibold text-gray-900">소매채널 선택</h3>
              </div>

              {isLoadingChannels ? (
                <div className="py-4 text-center text-gray-500 text-sm">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />
                  채널 로딩 중...
                </div>
              ) : channels.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-gray-500 text-sm mb-3">등록된 소매채널이 없습니다.</p>
                  <a
                    href="/channel"
                    className="text-primary-color text-sm font-medium hover:underline"
                  >
                    채널 관리에서 등록하기
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {channels.map((channel) => (
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

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="text-primary-color" size={20} />
                <h3 className="font-semibold text-gray-900">발행 정보</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">발행 대상</span>
                  <span className="font-medium">
                    {selectedChannel ? selectedChannel.name : '미선택'}
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
                선택한 상품이 지정한 소매채널에 발행됩니다.
              </p>
            </div>

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
                  소매채널에 발행하기
                </>
              )}
            </Button>

            {publishResult && (
              <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-green-600" size={20} />
                  <h4 className="font-medium text-green-900">발행 결과</h4>
                </div>
                <p className="text-sm text-green-700 mb-2">{publishResult.message}</p>
                <div className="text-xs text-green-600 space-y-1">
                  <p>성공: {publishResult.success}건</p>
                  {publishResult.skipped > 0 && <p>건너뜀: {publishResult.skipped}건</p>}
                  {publishResult.failed > 0 && <p>실패: {publishResult.failed}건</p>}
                </div>
              </div>
            )}

            <a
              href="http://localhost:3000/main"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <ExternalLink size={16} />
              쇼핑몰 미리보기
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
