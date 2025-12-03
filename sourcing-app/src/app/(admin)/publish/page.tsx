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
  XCircle,
} from 'lucide-react'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'

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
  const toast = useToast()

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
    // 이미 발행된 셀은 선택할 수 없음
    if (isPublished(productId, channelId)) return

    const key = cellKey(productId, channelId)
    setSelectedCells((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSelectRow = (productId: number) => {
    // 미발행 셀만 선택 가능
    const rowKeys = channels
      .filter((ch) => !isPublished(productId, ch.id))
      .map((ch) => cellKey(productId, ch.id))

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
    // 미발행 셀만 선택 가능
    const colKeys = products
      .filter((p) => !isPublished(p.id, channelId))
      .map((p) => cellKey(p.id, channelId))

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
    if (isPublishing) return  // 중복 호출 방지
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

      // 성공한 셀을 추적
      const successfulCells = new Set<string>()
      let totalSuccess = 0
      let totalSkipped = 0
      let totalFailed = 0

      for (const [channelId, productIds] of Object.entries(channelToProducts)) {
        if (productIds.length > 0) {
          const response = await fetch('/api/shop/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds, channelId: Number(channelId) }),
          })

          const data = await response.json()

          if (data.success && data.results) {
            // API 응답의 각 결과를 확인하여 성공한 것만 처리
            for (const result of data.results) {
              if (result.status === 'SUCCESS') {
                successfulCells.add(cellKey(result.productId, Number(channelId)))
                totalSuccess++
              } else if (result.status === 'SKIPPED') {
                // 이미 발행된 경우도 선택 해제
                successfulCells.add(cellKey(result.productId, Number(channelId)))
                totalSkipped++
              } else if (result.status === 'FAILED') {
                totalFailed++
              }
            }
          } else if (!data.success) {
            // 전체 요청 실패 시 해당 채널의 모든 상품을 실패로 처리
            totalFailed += productIds.length
          }
        }
      }

      // 성공한 셀만 선택 해제
      setSelectedCells((prev) => {
        const next = new Set(prev)
        successfulCells.forEach((key) => next.delete(key))
        return next
      })

      // 결과 알림
      if (totalFailed > 0) {
        toast.warning(`발행 결과: 성공 ${totalSuccess}개, 건너뜀 ${totalSkipped}개, 실패 ${totalFailed}개`)
      } else if (totalSuccess > 0) {
        toast.success(`${totalSuccess}개 상품 발행 완료`)
      } else if (totalSkipped > 0) {
        toast.info(`${totalSkipped}개 상품 이미 발행됨`)
      }

      loadProducts()
    } catch (error) {
      console.error('발행 실패:', error)
      toast.error('발행 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleUnpublishSelected = async () => {
    if (selectedCells.size === 0) return
    if (isPublishing) return  // 중복 호출 방지
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

  // 통계 계산
  const stats = useMemo(() => {
    const totalProducts = products.length
    const totalCells = products.length * channels.length
    let publishedCells = 0

    products.forEach((product) => {
      channels.forEach((channel) => {
        if (isPublished(product.id, channel.id)) {
          publishedCells++
        }
      })
    })

    return {
      totalProducts,
      totalChannels: channels.length,
      publishedCells,
      unpublishedCells: totalCells - publishedCells,
    }
  }, [products, channels])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">상품 발행</h1>
          <p className="text-gray-600">
            상품을 선택하여 채널에 발행합니다. 셀을 클릭하여 선택하고 발행 버튼을 누르세요.
          </p>
        </div>

        {/* 통계 및 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Package size={24} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 상품</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">발행됨</p>
                <p className="text-2xl font-bold text-green-600">{stats.publishedCells}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <XCircle size={24} className="text-gray-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">미발행</p>
                <p className="text-2xl font-bold text-gray-500">{stats.unpublishedCells}</p>
              </div>
            </div>
          </div>
          {/* 선택 발행 카드 */}
          <button
            onClick={handlePublishSelected}
            disabled={selectedUnpublishedCount === 0 || isPublishing}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left transition-colors ${
              selectedUnpublishedCount > 0 && !isPublishing
                ? 'hover:border-purple-300 hover:bg-purple-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${selectedUnpublishedCount > 0 ? 'bg-purple-100' : 'bg-gray-100'}`}>
                <Send size={24} className={selectedUnpublishedCount > 0 ? 'text-purple-600' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-sm text-gray-500">선택 발행</p>
                <p className={`text-lg font-bold ${selectedUnpublishedCount > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                  {selectedUnpublishedCount}개 선택됨
                </p>
              </div>
            </div>
          </button>
          {/* 선택 취소 카드 */}
          <button
            onClick={handleUnpublishSelected}
            disabled={selectedPublishedCount === 0 || isPublishing}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left transition-colors ${
              selectedPublishedCount > 0 && !isPublishing
                ? 'hover:border-red-300 hover:bg-red-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${selectedPublishedCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <XCircle size={24} className={selectedPublishedCount > 0 ? 'text-red-600' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-sm text-gray-500">선택 취소</p>
                <p className={`text-lg font-bold ${selectedPublishedCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {selectedPublishedCount}개 선택됨
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* 왼쪽: 범례 */}
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500 mr-2">범례:</span>
                <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-700 flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-500 flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </div>
                  발행됨
                </span>
                <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-gray-300" />
                  미발행
                </span>
                <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-purple-100 text-purple-700 flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-purple-500" />
                  선택됨
                </span>
              </div>

              {/* 오른쪽: 검색 */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <Input
                    type="text"
                    placeholder="상품 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && loadProducts()}
                    className="pl-10 w-64"
                  />
                </div>
                <button
                  onClick={loadProducts}
                  disabled={isLoading}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={20} className={isLoading ? 'animate-spin text-gray-400' : 'text-gray-600'} />
                </button>
              </div>
            </div>
          </div>

          {/* 매트릭스 테이블 */}
          {isLoading || isLoadingChannels ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <>
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
                          className="border-b border-gray-200 p-1 min-w-[80px] cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSelectColumn(ch.id)}
                          title={`${ch.name} 전체 선택/해제`}
                        >
                          <div className="text-xs text-gray-600 truncate max-w-[80px] mx-auto" title={ch.name}>
                            {ch.name.length > 8 ? ch.name.slice(0, 8) + '...' : ch.name}
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
                                    ? 'bg-purple-500 hover:bg-purple-600 cursor-pointer'
                                    : published
                                    ? 'bg-green-500 cursor-not-allowed'
                                    : 'bg-gray-200 hover:bg-gray-300 cursor-pointer'
                                }`}
                                title={`${product.name} → ${ch.name}: ${published ? '발행됨 (선택 불가)' : '미발행'}`}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
