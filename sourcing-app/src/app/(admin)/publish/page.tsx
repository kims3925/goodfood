'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Store,
  Search,
  RefreshCw,
  Package,
  Send,
  CheckCircle,
  ShoppingBag,
  Check,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'

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
  thumbnailUrl: string | null
  price: number | null
  publishedChannels: PublishedChannel[]
}

export default function PublishPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [isPublishing, setIsPublishing] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadChannels()
    loadProducts()
  }, [])

  const loadChannels = async () => {
    try {
      setIsLoadingChannels(true)
      const response = await fetch('/api/channel?kind=RETAIL&limit=100')
      const data = await response.json()
      if (data.success) {
        setChannels((data.data as Channel[]).filter((ch) => ch.isActive))
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
      const params = new URLSearchParams({ limit: '50' })
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/shop/publish?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setProducts(data.data)
      }
    } catch (error) {
      console.error('상품 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 플랫폼별 채널 그룹
  const groupedChannels = useMemo(() => {
    const groups: { platform: string; label: string; icon: React.ReactNode; channels: Channel[] }[] = [
      { platform: 'BAND', label: '밴드', icon: <BandIcon size={14} />, channels: [] },
      { platform: 'SHOP', label: '쇼핑몰', icon: <ShoppingBag size={14} />, channels: [] },
      { platform: 'OTHER', label: '기타', icon: <Store size={14} />, channels: [] },
    ]

    channels.forEach((ch) => {
      const group = groups.find((g) => g.platform === (ch.platform || 'OTHER'))
      if (group) group.channels.push(ch)
    })

    return groups.filter((g) => g.channels.length > 0)
  }, [channels])

  const isPublished = (productId: number, channelId: number) => {
    const product = products.find((p) => p.id === productId)
    return product?.publishedChannels?.some((pc) => pc.channelId === channelId)
  }

  const getPublishInfo = (productId: number, channelId: number) => {
    const product = products.find((p) => p.id === productId)
    return product?.publishedChannels?.find((pc) => pc.channelId === channelId)
  }

  const cellKey = (productId: number, channelId: number) => `${productId}-${channelId}`

  const handleCellClick = (productId: number, channelId: number) => {
    const key = cellKey(productId, channelId)
    setSelectedCells((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSelectRow = (productId: number) => {
    const rowKeys = channels.map((ch) => cellKey(productId, ch.id))
    setSelectedCells((prev) => {
      const allSelected = rowKeys.every((k) => prev.has(k))
      const next = new Set(prev)
      rowKeys.forEach((k) => {
        if (allSelected) next.delete(k)
        else next.add(k)
      })
      return next
    })
  }

  const handleSelectColumn = (channelId: number) => {
    const colKeys = products.map((p) => cellKey(p.id, channelId))
    setSelectedCells((prev) => {
      const allSelected = colKeys.every((k) => prev.has(k))
      const next = new Set(prev)
      colKeys.forEach((k) => {
        if (allSelected) next.delete(k)
        else next.add(k)
      })
      return next
    })
  }

  const handlePublishSelected = async () => {
    if (selectedCells.size === 0) return
    setIsPublishing(true)

    try {
      // 선택된 셀을 채널별로 그룹화
      const channelToProducts: Record<number, number[]> = {}
      selectedCells.forEach((key) => {
        const [productId, channelId] = key.split('-').map(Number)
        if (!isPublished(productId, channelId)) {
          if (!channelToProducts[channelId]) channelToProducts[channelId] = []
          channelToProducts[channelId].push(productId)
        }
      })

      for (const [channelId, productIds] of Object.entries(channelToProducts)) {
        if (productIds.length > 0) {
          await fetch('/api/shop/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds, channelId: Number(channelId) }),
          })
        }
      }

      setSelectedCells(new Set())
      loadProducts()
    } catch (error) {
      console.error('발행 실패:', error)
    } finally {
      setIsPublishing(false)
    }
  }

  const handleUnpublishSelected = async () => {
    if (selectedCells.size === 0) return
    if (!confirm('선택한 발행을 취소하시겠습니까?')) return

    setIsPublishing(true)
    try {
      const publishIds: number[] = []
      selectedCells.forEach((key) => {
        const [productId, channelId] = key.split('-').map(Number)
        const info = getPublishInfo(productId, channelId)
        if (info) publishIds.push(info.publishId)
      })

      if (publishIds.length > 0) {
        await fetch(`/api/shop/publish?ids=${publishIds.join(',')}`, { method: 'DELETE' })
      }

      setSelectedCells(new Set())
      loadProducts()
    } catch (error) {
      console.error('발행 취소 실패:', error)
    } finally {
      setIsPublishing(false)
    }
  }

  const formatPrice = (price: number | null) => (!price ? '-' : `₩${price.toLocaleString()}`)

  const selectedPublishedCount = Array.from(selectedCells).filter((key) => {
    const [productId, channelId] = key.split('-').map(Number)
    return isPublished(productId, channelId)
  }).length

  const selectedUnpublishedCount = selectedCells.size - selectedPublishedCount

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Send className="text-purple-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">상품 발행</h1>
          </div>
          <p className="text-gray-600">행(상품) × 열(채널) 매트릭스로 한눈에 발행 현황 확인. 셀 클릭으로 선택, 일괄 발행/취소</p>
        </div>

        {/* 컨트롤 바 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  type="text"
                  placeholder="상품 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && loadProducts()}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="secondary" onClick={loadProducts} disabled={isLoading}>
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              {selectedCells.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedCells.size}개 선택 (발행됨: {selectedPublishedCount}, 미발행: {selectedUnpublishedCount})
                </span>
              )}
              <Button
                variant="primary"
                onClick={handlePublishSelected}
                disabled={selectedUnpublishedCount === 0 || isPublishing}
              >
                <Send size={16} />
                선택 발행 ({selectedUnpublishedCount})
              </Button>
              <Button
                variant="secondary"
                onClick={handleUnpublishSelected}
                disabled={selectedPublishedCount === 0 || isPublishing}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                선택 취소 ({selectedPublishedCount})
              </Button>
            </div>
          </div>
        </div>

        {/* 범례 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-gray-500">범례:</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-green-500 flex items-center justify-center">
                <Check size={14} className="text-white" />
              </div>
              <span>발행됨</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gray-200" />
              <span>미발행</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-500" />
              <span>선택됨</span>
            </div>
          </div>
        </div>

        {/* 매트릭스 테이블 */}
        {isLoading || isLoadingChannels ? (
          <div className="bg-white rounded-lg shadow-sm border p-12">
            <Loading />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 p-2 text-left min-w-[100px]">
                      <span className="text-xs font-medium text-gray-500 uppercase">상품</span>
                    </th>
                    {groupedChannels.map((group) => (
                      <th
                        key={group.platform}
                        colSpan={group.channels.length}
                        className="border-b border-gray-200 p-2 text-center"
                      >
                        <div className="flex items-center justify-center gap-1 text-xs font-medium text-gray-700">
                          {group.icon}
                          {group.label}
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 p-2" />
                    {groupedChannels.map((group) =>
                      group.channels.map((ch) => (
                        <th
                          key={ch.id}
                          className="border-b border-gray-200 p-1 min-w-[60px] cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSelectColumn(ch.id)}
                          title={`${ch.name} 전체 선택/해제`}
                        >
                          <div className="text-xs text-gray-600 truncate max-w-[60px] mx-auto" title={ch.name}>
                            {ch.name.length > 6 ? ch.name.slice(0, 6) + '...' : ch.name}
                          </div>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td
                        className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 p-2 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSelectRow(product.id)}
                        title="행 전체 선택/해제"
                      >
                        <div className="flex items-center gap-2">
                          {product.thumbnailUrl ? (
                            <img src={product.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center">
                              <Package size={14} className="text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[70px]">{product.name}</div>
                            <div className="text-xs text-gray-500">{formatPrice(product.price)}</div>
                          </div>
                        </div>
                      </td>
                      {groupedChannels.map((group) =>
                        group.channels.map((ch) => {
                          const published = isPublished(product.id, ch.id)
                          const selected = selectedCells.has(cellKey(product.id, ch.id))

                          return (
                            <td
                              key={ch.id}
                              className="border-b border-gray-200 p-1 text-center"
                            >
                              <button
                                onClick={() => handleCellClick(product.id, ch.id)}
                                className={`w-8 h-8 rounded transition-all ${
                                  selected
                                    ? 'bg-purple-500 hover:bg-purple-600'
                                    : published
                                    ? 'bg-green-500 hover:bg-green-600'
                                    : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                                title={`${product.name} → ${ch.name}: ${published ? '발행됨' : '미발행'}`}
                              >
                                {published && <Check size={16} className="text-white mx-auto" />}
                              </button>
                            </td>
                          )
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {products.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <Package size={48} className="mx-auto mb-4 text-gray-300" />
                상품이 없습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
