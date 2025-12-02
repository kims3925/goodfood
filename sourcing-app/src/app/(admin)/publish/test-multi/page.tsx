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
  Check,
  Minus,
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

type TabType = 'unpublished' | 'published' | 'partial' | 'all'

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bgColor: string; textColor: string; icon: React.ReactNode }> = {
  SHOP: { label: '쇼핑몰', color: 'text-blue-600', bgColor: 'bg-blue-100', textColor: 'text-blue-700', icon: <ShoppingBag size={14} /> },
  BAND: { label: '밴드', color: 'text-green-600', bgColor: 'bg-green-100', textColor: 'text-green-700', icon: <BandIcon size={14} /> },
  OTHER: { label: '기타', color: 'text-gray-600', bgColor: 'bg-gray-100', textColor: 'text-gray-700', icon: <Store size={14} /> },
}

export default function TestMultiPublishPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)

  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)

  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectAllProducts, setSelectAllProducts] = useState(false)

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

        // 통계 계산
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

  const isPublishedOnChannel = (product: Product, channelId: number) => {
    return product.publishedChannels?.some((pc) => pc.channelId === channelId)
  }

  const getPublishIdForChannel = (product: Product, channelId: number) => {
    const matched = product.publishedChannels?.find((pc) => pc.channelId === channelId)
    return matched?.publishId || null
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
      // 각 채널에 대해 발행 요청
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

  const getChannelPlatformConfig = (channel: Channel) => {
    if (channel.platform === 'SHOP') return PLATFORM_CONFIG.SHOP
    if (channel.platform === 'BAND') return PLATFORM_CONFIG.BAND
    return PLATFORM_CONFIG.OTHER
  }

  // 상품의 발행 상태 계산
  const getProductPublishStatus = (product: Product) => {
    const publishedCount = product.publishedChannels?.length || 0
    if (publishedCount === 0) return 'none'
    if (publishedCount >= channels.length && channels.length > 0) return 'full'
    return 'partial'
  }

  // 탭에 따라 상품 필터링
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
      <div className="max-w-[1900px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Send className="text-purple-600" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">상품 발행</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 ml-2">
                테스트 B: 다중 채널 동시 발행
              </span>
            </div>
          </div>
          <p className="text-gray-600">
            여러 채널을 선택하고 상품을 한번에 발행하세요. 채널별 발행 현황을 한눈에 확인할 수 있습니다.
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

        {/* 발행 채널 선택 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Store className="text-purple-600" size={20} />
              <h3 className="font-semibold text-gray-900">발행 채널 선택 (다중 선택)</h3>
              <span className="text-sm text-gray-500">
                {selectedChannelIds.length > 0 && `${selectedChannelIds.length}개 선택됨`}
              </span>
            </div>
            <button
              onClick={handleSelectAllChannels}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              {selectedChannelIds.length === channels.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          {isLoadingChannels ? (
            <div className="py-8 text-center text-gray-500">
              <RefreshCw size={20} className="animate-spin inline mr-2" />
              채널 로딩 중...
            </div>
          ) : channels.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              등록된 채널이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {/* 쇼핑몰 */}
              {groupedChannels.SHOP.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag size={16} className="text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">쇼핑몰</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {groupedChannels.SHOP.map((channel) => (
                      <ChannelCheckbox
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
                    <BandIcon size={16} className="text-green-600" />
                    <span className="text-sm font-medium text-gray-700">밴드</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {groupedChannels.BAND.map((channel) => (
                      <ChannelCheckbox
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
                    <Store size={16} className="text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">기타</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {groupedChannels.OTHER.map((channel) => (
                      <ChannelCheckbox
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

        {/* 메인 콘텐츠 */}
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

              {/* 탭 필터 */}
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

              <Button
                variant="primary"
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
                    {selectedChannelIds.length}개 채널에 발행 ({selectedProductIds.length}개 상품)
                  </>
                )}
              </Button>
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
                    <TableHead className="min-w-[250px]">상품명</TableHead>
                    <TableHead className="w-[100px]">판매가</TableHead>
                    {/* 채널별 발행 상태 컬럼 */}
                    {channels.map((channel) => {
                      const config = getChannelPlatformConfig(channel)
                      return (
                        <TableHead key={channel.id} className="w-[80px] text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={config.color}>{config.icon}</span>
                            <span className="text-xs truncate max-w-[70px]" title={channel.name}>
                              {channel.name.length > 6 ? channel.name.slice(0, 6) + '..' : channel.name}
                            </span>
                          </div>
                        </TableHead>
                      )
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableEmpty message="상품이 없습니다." />
                  ) : (
                    filteredProducts.map((product) => (
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
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <Package size={16} className="text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-gray-900 truncate text-sm">{product.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-gray-900 text-sm">{formatPrice(product.price)}</span>
                        </TableCell>
                        {/* 채널별 발행 상태 */}
                        {channels.map((channel) => {
                          const isPublished = isPublishedOnChannel(product, channel.id)
                          const publishId = getPublishIdForChannel(product, channel.id)
                          return (
                            <TableCell key={channel.id} className="text-center">
                              {isPublished ? (
                                <div className="flex items-center justify-center gap-1">
                                  <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                                    <Check size={14} className="text-green-600" />
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (publishId) handleUnpublish([publishId])
                                    }}
                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                    title="발행 취소"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full">
                                  <Minus size={14} className="text-gray-400" />
                                </span>
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))
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

        {/* 하단 링크 */}
        <div className="mt-6 flex justify-center">
          <a
            href="http://localhost:3000/main"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <ExternalLink size={16} />
            쇼핑몰 미리보기
          </a>
        </div>
      </div>
    </div>
  )
}

// 채널 체크박스 컴포넌트
function ChannelCheckbox({
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
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-purple-600 bg-purple-50'
          : `border-gray-200 ${config.bgColor} hover:border-gray-300`
      }`}
    >
      <div
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
        }`}
      >
        {isSelected && <Check size={14} className="text-white" />}
      </div>
      <span className={config.color}>{config.icon}</span>
      <span className={`text-sm font-medium ${isSelected ? 'text-purple-700' : config.textColor}`}>
        {channel.name}
      </span>
    </button>
  )
}
