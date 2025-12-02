'use client'

import { useEffect, useMemo, useState, Fragment } from 'react'
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
  Check,
  Minus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'

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

type TabType = 'unpublished' | 'published' | 'partial' | 'all'

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bgColor: string; textColor: string; icon: React.ReactNode }> = {
  SHOP: { label: '쇼핑몰', color: 'text-blue-600', bgColor: 'bg-blue-100', textColor: 'text-blue-700', icon: <ShoppingBag size={14} /> },
  BAND: { label: '밴드', color: 'text-green-600', bgColor: 'bg-green-100', textColor: 'text-green-700', icon: <BandIcon size={14} /> },
  OTHER: { label: '기타', color: 'text-gray-600', bgColor: 'bg-gray-100', textColor: 'text-gray-700', icon: <Store size={14} /> },
}

export default function PublishPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)

  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)

  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectAllProducts, setSelectAllProducts] = useState(false)
  const [expandedProductIds, setExpandedProductIds] = useState<number[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('all')

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  const [stats, setStats] = useState({ total: 0, fullyPublished: 0, partiallyPublished: 0, unpublished: 0 })

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
  }, [currentPage, activeTab])

  const loadChannels = async () => {
    try {
      setIsLoadingChannels(true)
      const response = await fetch('/api/channel?kind=RETAIL&limit=100')
      const data = await response.json()

      if (data.success) {
        const activeChannels = (data.data as Channel[]).filter((ch) => ch.isActive)
        setChannels(activeChannels)
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
        setProducts(data.data)
        setTotalItems(data.pagination.total)
        setTotalPages(data.pagination.totalPages)

        const allProducts = data.data as Product[]
        let fullyPublished = 0
        let partiallyPublished = 0
        let unpublished = 0

        allProducts.forEach((p) => {
          const publishedCount = p.publishedChannels?.length || 0
          if (publishedCount === 0) {
            unpublished++
          } else if (publishedCount >= channels.length && channels.length > 0) {
            fullyPublished++
          } else {
            partiallyPublished++
          }
        })

        setStats({
          total: data.pagination.total,
          fullyPublished,
          partiallyPublished,
          unpublished,
        })
      }
    } catch (error) {
      console.error('상품 목록 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

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

  const handleSearch = () => {
    setCurrentPage(1)
    loadProducts()
  }

  const handleToggleChannel = (channelId: number) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    )
  }

  const handleSelectAllChannels = () => {
    if (selectedChannelIds.length === channels.length) {
      setSelectedChannelIds([])
    } else {
      setSelectedChannelIds(channels.map((ch) => ch.id))
    }
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

  const handleToggleExpand = (productId: number) => {
    setExpandedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  const getPublishInfoForChannel = (product: Product, channelId: number) => {
    return product.publishedChannels?.find((pc) => pc.channelId === channelId) || null
  }

  const handlePublish = async () => {
    if (selectedProductIds.length === 0 || selectedChannelIds.length === 0) {
      return
    }

    setIsPublishing(true)
    setPublishResult(null)

    let totalSuccess = 0
    let totalSkipped = 0
    let totalFailed = 0

    try {
      for (const channelId of selectedChannelIds) {
        try {
          const response = await fetch('/api/shop/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productIds: selectedProductIds,
              channelId: channelId,
            }),
          })

          const data = await response.json()

          if (data.success) {
            totalSuccess += data.summary.success
            totalSkipped += data.summary.skipped
            totalFailed += data.summary.failed
          } else {
            totalFailed += selectedProductIds.length
          }
        } catch {
          totalFailed += selectedProductIds.length
        }
      }

      setPublishResult({
        success: totalSuccess,
        skipped: totalSkipped,
        failed: totalFailed,
        message: `${selectedChannelIds.length}개 채널에 발행 완료`,
      })

      setSelectedProductIds([])
      setSelectAllProducts(false)
      loadProducts()
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  const getChannelPlatformConfig = (channel: Channel) => {
    if (channel.platform === 'SHOP') return PLATFORM_CONFIG.SHOP
    if (channel.platform === 'BAND') return PLATFORM_CONFIG.BAND
    return PLATFORM_CONFIG.OTHER
  }

  const getProductPublishStatus = (product: Product) => {
    const publishedCount = product.publishedChannels?.length || 0
    if (publishedCount === 0) return 'none'
    if (publishedCount >= channels.length && channels.length > 0) return 'full'
    return 'partial'
  }

  const getPublishStatusDisplay = (product: Product) => {
    const publishedCount = product.publishedChannels?.length || 0
    const totalChannels = channels.length
    const status = getProductPublishStatus(product)
    return { publishedCount, totalChannels, status }
  }

  const filteredProducts = useMemo(() => {
    if (activeTab === 'all') return products

    return products.filter((p) => {
      const status = getProductPublishStatus(p)
      if (activeTab === 'unpublished') return status === 'none'
      if (activeTab === 'published') return status === 'full'
      if (activeTab === 'partial') return status === 'partial'
      return true
    })
  }, [products, activeTab, channels.length])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Send className="text-purple-600" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">상품 발행</h1>
            </div>
          </div>
          <p className="text-gray-600">
            사이드바에서 여러 채널을 선택하고 상품을 한번에 발행하세요. 행을 클릭하면 채널별 발행 현황을 확인할 수 있습니다.
          </p>
        </div>

        {/* 대시보드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                <p className="text-sm text-gray-500">완전 발행</p>
                <p className="text-2xl font-bold text-green-600">{stats.fullyPublished}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Minus className="text-orange-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">부분 발행</p>
                <p className="text-2xl font-bold text-orange-600">{stats.partiallyPublished}</p>
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

        {/* 메인 콘텐츠 - 3:1 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 상품 목록 - 3/4 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* 상단 컨트롤 */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex gap-2 items-center">
                    <div className="relative w-64">
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
                    <Button variant="secondary" onClick={loadProducts} disabled={isLoading}>
                      <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </Button>
                  </div>

                  <div className="flex gap-1">
                    {(['all', 'unpublished', 'partial', 'published'] as TabType[]).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                          activeTab === tab
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {tab === 'all' ? '전체' : tab === 'unpublished' ? '미발행' : tab === 'partial' ? '부분발행' : '완전발행'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 발행 결과 */}
              {publishResult && (
                <div className="p-4 bg-green-50 border-b border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-green-600" size={20} />
                    <span className="font-medium text-green-900">{publishResult.message}</span>
                    <span className="text-sm text-green-700">
                      (성공: {publishResult.success}, 건너뜀: {publishResult.skipped}, 실패: {publishResult.failed})
                    </span>
                    <button onClick={() => setPublishResult(null)} className="ml-auto text-green-600 hover:text-green-700">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* 테이블 */}
              {isLoading ? (
                <div className="p-12"><Loading /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <input
                            type="checkbox"
                            checked={selectAllProducts}
                            onChange={handleToggleSelectAllProducts}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="min-w-[300px]">상품명</TableHead>
                        <TableHead className="w-[120px]">판매가</TableHead>
                        <TableHead className="w-[150px]">발행 상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.length === 0 ? (
                        <TableEmpty message="상품이 없습니다." />
                      ) : (
                        filteredProducts.map((product) => {
                          const isExpanded = expandedProductIds.includes(product.id)
                          const { publishedCount, totalChannels, status } = getPublishStatusDisplay(product)

                          return (
                            <Fragment key={product.id}>
                              <TableRow
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleToggleExpand(product.id)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedProductIds.includes(product.id)}
                                    onChange={() => handleToggleProductSelection(product.id)}
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell>
                                  {isExpanded ? (
                                    <ChevronDown size={16} className="text-gray-400" />
                                  ) : (
                                    <ChevronRight size={16} className="text-gray-400" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    {product.thumbnailUrl ? (
                                      <img
                                        src={product.thumbnailUrl}
                                        alt={product.name}
                                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                        <Package size={16} className="text-gray-400" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium text-gray-900 truncate">{product.name}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="font-medium text-gray-900">{formatPrice(product.price)}</span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                                      <div
                                        className={`h-full transition-all ${
                                          status === 'full' ? 'bg-green-500' :
                                          status === 'partial' ? 'bg-orange-500' : 'bg-gray-300'
                                        }`}
                                        style={{ width: totalChannels > 0 ? `${(publishedCount / totalChannels) * 100}%` : '0%' }}
                                      />
                                    </div>
                                    <span className={`text-sm font-medium ${
                                      status === 'full' ? 'text-green-600' :
                                      status === 'partial' ? 'text-orange-600' : 'text-gray-500'
                                    }`}>
                                      {publishedCount}/{totalChannels}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {/* 확장된 채널별 상세 */}
                              {isExpanded && (
                                <tr className="bg-gray-50">
                                  <td colSpan={5} className="px-4 py-3">
                                    <div className="pl-14">
                                      <div className="text-xs font-medium text-gray-500 mb-2">채널별 발행 현황</div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {channels.map((channel) => {
                                          const publishInfo = getPublishInfoForChannel(product, channel.id)
                                          const config = getChannelPlatformConfig(channel)
                                          const isPublished = !!publishInfo

                                          return (
                                            <div
                                              key={channel.id}
                                              className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                                                isPublished
                                                  ? 'bg-green-50 border-green-200'
                                                  : 'bg-white border-gray-200'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2">
                                                <span className={config.color}>{config.icon}</span>
                                                <span className="text-sm font-medium text-gray-700">{channel.name}</span>
                                              </div>
                                              {isPublished ? (
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs text-green-600">
                                                    {formatDate(publishInfo.createdAt)}
                                                  </span>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handleUnpublish([publishInfo.publishId])
                                                    }}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                    title="발행 취소"
                                                  >
                                                    <X size={14} />
                                                  </button>
                                                </div>
                                              ) : (
                                                <span className="text-xs text-gray-400">미발행</span>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
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

          {/* 사이드바: 채널 선택 + 발행 정보 - 1/4 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 채널 선택 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Store className="text-purple-600" size={20} />
                  <h3 className="font-semibold text-gray-900">발행 채널</h3>
                </div>
                <button
                  onClick={handleSelectAllChannels}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  {selectedChannelIds.length === channels.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>

              {isLoadingChannels ? (
                <div className="py-4 text-center text-gray-500">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />
                  로딩...
                </div>
              ) : channels.length === 0 ? (
                <div className="py-4 text-center text-gray-500 text-sm">
                  등록된 채널이 없습니다.
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {/* 쇼핑몰 */}
                  {groupedChannels.SHOP.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingBag size={14} className="text-blue-600" />
                        <span className="text-xs font-medium text-gray-700">쇼핑몰</span>
                      </div>
                      <div className="space-y-1">
                        {groupedChannels.SHOP.map((channel) => (
                          <ChannelCheckboxCompact
                            key={channel.id}
                            channel={channel}
                            isSelected={selectedChannelIds.includes(channel.id)}
                            onToggle={() => handleToggleChannel(channel.id)}
                            config={PLATFORM_CONFIG.SHOP}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 밴드 */}
                  {groupedChannels.BAND.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <BandIcon size={14} className="text-green-600" />
                        <span className="text-xs font-medium text-gray-700">밴드</span>
                      </div>
                      <div className="space-y-1">
                        {groupedChannels.BAND.map((channel) => (
                          <ChannelCheckboxCompact
                            key={channel.id}
                            channel={channel}
                            isSelected={selectedChannelIds.includes(channel.id)}
                            onToggle={() => handleToggleChannel(channel.id)}
                            config={PLATFORM_CONFIG.BAND}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 기타 */}
                  {groupedChannels.OTHER.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Store size={14} className="text-gray-600" />
                        <span className="text-xs font-medium text-gray-700">기타</span>
                      </div>
                      <div className="space-y-1">
                        {groupedChannels.OTHER.map((channel) => (
                          <ChannelCheckboxCompact
                            key={channel.id}
                            channel={channel}
                            isSelected={selectedChannelIds.includes(channel.id)}
                            onToggle={() => handleToggleChannel(channel.id)}
                            config={PLATFORM_CONFIG.OTHER}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 발행 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="text-purple-600" size={20} />
                <h3 className="font-semibold text-gray-900">발행 정보</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">선택한 채널</span>
                  <span className="font-medium text-purple-600">{selectedChannelIds.length}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">선택한 상품</span>
                  <span className="font-medium">{selectedProductIds.length}개</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-700 font-medium">발행 예정</span>
                    <span className="font-bold text-purple-600">
                      {selectedChannelIds.length * selectedProductIds.length}건
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    ({selectedProductIds.length}개 상품 × {selectedChannelIds.length}개 채널)
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full py-3"
              onClick={handlePublish}
              disabled={selectedProductIds.length === 0 || selectedChannelIds.length === 0 || isPublishing}
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

// 사이드바용 컴팩트한 채널 체크박스
function ChannelCheckboxCompact({
  channel,
  isSelected,
  onToggle,
  config,
}: {
  channel: Channel
  isSelected: boolean
  onToggle: () => void
  config: { label: string; color: string; bgColor: string; textColor: string; icon: React.ReactNode }
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md border transition-all text-left ${
        isSelected
          ? 'border-purple-600 bg-purple-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
          isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
        }`}
      >
        {isSelected && <Check size={12} className="text-white" />}
      </div>
      <span className={`${config.color} flex-shrink-0`}>{config.icon}</span>
      <span className={`text-sm truncate ${isSelected ? 'text-purple-700 font-medium' : 'text-gray-700'}`}>
        {channel.name}
      </span>
    </button>
  )
}
