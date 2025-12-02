'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Store,
  Search,
  RefreshCw,
  Package,
  X,
  Send,
  Globe,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  ShoppingBag,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'

// 밴드 아이콘
const BandIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
)

interface Channel {
  id: number
  name: string
  channelKey: string
  coverUrl: string | null
  platform: string | null
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
type PlatformType = 'ALL' | 'SHOP' | 'BAND' | 'OTHER'

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  SHOP: { label: '쇼핑몰', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', icon: <ShoppingBag size={16} /> },
  BAND: { label: '밴드', color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', icon: <BandIcon size={16} /> },
  OTHER: { label: '기타', color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', icon: <Store size={16} /> },
}

export default function TestSinglePublishPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)

  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)
  const [platformFilter, setPlatformFilter] = useState<PlatformType>('ALL')

  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectAllProducts, setSelectAllProducts] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('unpublished')

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  const [stats, setStats] = useState({ total: 0, published: 0, unpublished: 0 })

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
        const activeChannels = (data.data as Channel[]).filter((ch) => ch.isActive)
        setChannels(activeChannels)
        if (activeChannels.length > 0 && !selectedChannelId) {
          setSelectedChannelId(activeChannels[0].id)
        }
      }
    } catch (error) {
      console.error('채널 조회 실패:', error)
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

        if (data.stats) {
          setStats({
            total: data.stats.total,
            published: data.stats.published,
            unpublished: data.stats.unpublished,
          })
        }
      }
    } catch (error) {
      console.error('상품 목록 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 플랫폼별 채널 그룹화
  const groupedChannels = useMemo(() => {
    const groups: Record<string, Channel[]> = {
      SHOP: [],
      BAND: [],
      OTHER: [],
    }

    channels.forEach((ch) => {
      if (ch.platform === 'SHOP') {
        groups.SHOP.push(ch)
      } else if (ch.platform === 'BAND') {
        groups.BAND.push(ch)
      } else {
        groups.OTHER.push(ch)
      }
    })

    return groups
  }, [channels])

  // 필터링된 채널
  const filteredChannels = useMemo(() => {
    if (platformFilter === 'ALL') return channels
    return groupedChannels[platformFilter] || []
  }, [channels, groupedChannels, platformFilter])

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

  const selectedChannel = useMemo(
    () => channels.find((ch) => ch.id === selectedChannelId) || null,
    [channels, selectedChannelId]
  )

  const getChannelPlatformConfig = (channel: Channel) => {
    if (channel.platform === 'SHOP') return PLATFORM_CONFIG.SHOP
    if (channel.platform === 'BAND') return PLATFORM_CONFIG.BAND
    return PLATFORM_CONFIG.OTHER
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Send className="text-purple-600" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">상품 발행</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 ml-2">
                테스트 A: 단일 채널 선택
              </span>
            </div>
          </div>
          <p className="text-gray-600">
            모든 소매 채널(쇼핑몰, 밴드, 카페 등)을 하나의 페이지에서 관리합니다. 채널을 선택하고 상품을 발행하세요.
          </p>
        </div>

        {/* 대시보드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 상품</p>
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
                <p className="text-sm text-gray-500">미발행</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.unpublished}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 발행 채널 선택 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Store className="text-purple-600" size={20} />
              <h3 className="font-semibold text-gray-900">발행 채널 선택</h3>
            </div>
            {/* 플랫폼 필터 */}
            <div className="flex gap-1">
              {(['ALL', 'SHOP', 'BAND', 'OTHER'] as PlatformType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setPlatformFilter(type)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                    platformFilter === type
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {type === 'ALL' ? '전체' : PLATFORM_CONFIG[type]?.label || type}
                </button>
              ))}
            </div>
          </div>

          {isLoadingChannels ? (
            <div className="py-8 text-center text-gray-500">
              <RefreshCw size={20} className="animate-spin inline mr-2" />
              채널 로딩 중...
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              해당 플랫폼에 등록된 채널이 없습니다.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredChannels.map((channel) => {
                const config = getChannelPlatformConfig(channel)
                const isSelected = selectedChannelId === channel.id
                return (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannelId(channel.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50'
                        : `${config.bgColor} hover:border-gray-400`
                    }`}
                  >
                    <span className={config.color}>{config.icon}</span>
                    <span className={`font-medium ${isSelected ? 'text-purple-700' : 'text-gray-700'}`}>
                      {channel.name}
                    </span>
                    {isSelected && <CheckCircle size={16} className="text-purple-600" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 메인 콘텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 상품 목록 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* 탭 */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  {(['unpublished', 'published', 'all'] as TabType[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab)
                        setCurrentPage(1)
                      }}
                      className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab
                          ? 'border-purple-600 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab === 'unpublished' ? '미발행' : tab === 'published' ? '발행 완료' : '전체'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 검색 */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex gap-4 items-center justify-between">
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
                  <Button variant="secondary" onClick={loadProducts} disabled={isLoading}>
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    새로고침
                  </Button>
                </div>
              </div>

              {/* 테이블 */}
              {isLoading ? (
                <div className="p-12"><Loading /></div>
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
                      <TableEmpty message="상품이 없습니다." />
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
                                  <div className="font-medium text-gray-900 truncate">{product.name}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">{product.publishSummary}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-gray-600">{formatPrice(product.wholesalePrice)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-gray-900">{formatPrice(product.price)}</span>
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

          {/* 사이드바: 발행 정보 */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="text-purple-600" size={20} />
                <h3 className="font-semibold text-gray-900">발행 정보</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">발행 대상</span>
                  <span className="font-medium flex items-center gap-1">
                    {selectedChannel ? (
                      <>
                        <span className={getChannelPlatformConfig(selectedChannel).color}>
                          {getChannelPlatformConfig(selectedChannel).icon}
                        </span>
                        {selectedChannel.name}
                      </>
                    ) : (
                      '미선택'
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">선택한 상품</span>
                  <span className="font-medium">{selectedProductIds.length}개</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-700 font-medium">발행 예정</span>
                    <span className="font-bold text-purple-600">{selectedProductIds.length}건</span>
                  </div>
                </div>
              </div>
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
                  선택 채널에 발행하기
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
