'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  ShoppingCart,
  AlertTriangle,
  ExternalLink,
  Trash2,
} from 'lucide-react'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'
import Button from '@/components/ui/Button'

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

interface Shop {
  id: number
  name: string
  subdomain: string
  coverUrl: string | null
  isActive: boolean
}

interface PublishedChannel {
  publishId: number
  channelId: number | null
  channelName: string | null
  status: string
  createdAt: string
}

interface PublishedShop {
  publishId: number
  shopId: number | null
  shopName: string | null
  subdomain: string | null
  status: string
  createdAt: string
}

interface WholesaleChannel {
  id: number
  name: string
}

interface Product {
  id: number
  name: string
  thumbnailUrl: string | null
  price: number | null
  channel: WholesaleChannel | null
  publishedChannels: PublishedChannel[]
  publishedShops: PublishedShop[]
}

export default function PublishPage() {
  const toast = useToast()
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)

  const [shops, setShops] = useState<Shop[]>([])
  const [isLoadingShops, setIsLoadingShops] = useState(true)

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [isPublishing, setIsPublishing] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')

  // 도매밴드 필터
  const [selectedWholesaleChannel, setSelectedWholesaleChannel] = useState<number | null>(null)
  const [wholesaleChannels, setWholesaleChannels] = useState<WholesaleChannel[]>([])

  // 페이징
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const pageSize = 20

  // 가격 미설정 상품 경고 모달
  const [showPriceWarning, setShowPriceWarning] = useState(false)
  const [warningProduct, setWarningProduct] = useState<Product | null>(null)

  // 발행 취소 확인 모달
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false)
  const [unpublishTarget, setUnpublishTarget] = useState<{
    productId: number
    productName: string
    shopId: number
    shopName: string
    publishId: number
  } | null>(null)
  const [isUnpublishing, setIsUnpublishing] = useState(false)

  // 초기 로드
  useEffect(() => {
    loadChannels()
    loadShops()
  }, [])

  // 페이지/필터 변경 시 상품 로드
  useEffect(() => {
    loadProducts()
  }, [currentPage, selectedWholesaleChannel])

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

  const loadShops = async () => {
    try {
      setIsLoadingShops(true)
      const response = await fetch('/api/shop?isActive=true&limit=100')
      const data = await response.json()
      if (data.success) {
        setShops(data.data as Shop[])
      }
    } catch (error) {
      console.error('Shop 조회 실패:', error)
    } finally {
      setIsLoadingShops(false)
    }
  }

  const loadProducts = async (resetPage = false) => {
    try {
      setIsLoading(true)
      const page = resetPage ? 1 : currentPage
      if (resetPage) setCurrentPage(1)

      const params = new URLSearchParams({
        limit: String(pageSize),
        page: String(page),
      })
      if (searchTerm) params.append('search', searchTerm)
      if (selectedWholesaleChannel) params.append('channelId', String(selectedWholesaleChannel))

      const response = await fetch(`/api/shop/publish?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setProducts(data.data)
        setTotalPages(data.pagination?.totalPages || 1)
        setTotalProducts(data.pagination?.total || 0)

        // 도매밴드 목록 추출 (전체 상품에서 중복 제거)
        const channelMap = new Map<number, WholesaleChannel>()
        data.data.forEach((product: Product) => {
          if (product.channel && product.channel.id) {
            channelMap.set(product.channel.id, product.channel)
          }
        })

        // 기존 wholesaleChannels와 병합 (필터가 변경되지 않으면 유지)
        if (!selectedWholesaleChannel) {
          setWholesaleChannels((prev) => {
            const merged = new Map<number, WholesaleChannel>()
            prev.forEach((ch) => merged.set(ch.id, ch))
            channelMap.forEach((ch, id) => merged.set(id, ch))
            return Array.from(merged.values())
          })
        }
      }
    } catch (error) {
      console.error('상품 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 플랫폼별 채널 그룹 (Shop 포함)
  const groupedTargets = useMemo(() => {
    const groups: {
      type: 'shop' | 'channel'
      platform: string
      label: string
      icon: React.ReactNode
      items: (Channel | Shop)[]
    }[] = [
      { type: 'shop', platform: 'SHOP', label: 'Shop', icon: <ShoppingCart size={14} />, items: [] },
      { type: 'channel', platform: 'BAND', label: '밴드', icon: <BandIcon size={14} />, items: [] },
      { type: 'channel', platform: 'OTHER', label: '기타', icon: <Store size={14} />, items: [] },
    ]

    // Shop 추가
    shops.forEach((shop) => {
      const group = groups.find((g) => g.platform === 'SHOP')
      if (group) group.items.push(shop)
    })

    // 채널 추가
    channels.forEach((ch) => {
      const group = groups.find((g) => g.platform === (ch.platform || 'OTHER'))
      if (group) group.items.push(ch)
    })

    return groups.filter((g) => g.items.length > 0)
  }, [channels, shops])

  // 총 타겟 수 (채널 + Shop)
  const allTargets = useMemo(() => {
    const targets: { type: 'shop' | 'channel'; id: number; name: string }[] = []
    shops.forEach((shop) => targets.push({ type: 'shop', id: shop.id, name: shop.name }))
    channels.forEach((ch) => targets.push({ type: 'channel', id: ch.id, name: ch.name }))
    return targets
  }, [channels, shops])

  // 채널 발행 여부 확인
  const isPublishedToChannel = (productId: number, channelId: number) => {
    const product = products.find((p) => p.id === productId)
    return product?.publishedChannels?.some((pc) => pc.channelId === channelId)
  }

  // Shop 발행 여부 확인
  const isPublishedToShop = (productId: number, shopId: number) => {
    const product = products.find((p) => p.id === productId)
    return product?.publishedShops?.some((ps) => ps.shopId === shopId)
  }

  // 타겟에 발행되었는지 확인 (type으로 구분)
  const isPublished = (productId: number, targetType: 'shop' | 'channel', targetId: number) => {
    if (targetType === 'shop') {
      return isPublishedToShop(productId, targetId)
    }
    return isPublishedToChannel(productId, targetId)
  }

  // 가격이 설정되어 있는지 확인
  const hasPrice = (productId: number) => {
    const product = products.find((p) => p.id === productId)
    return product?.price && product.price > 0
  }

  // 상품 객체 가져오기
  const getProduct = (productId: number) => {
    return products.find((p) => p.id === productId)
  }

  // Shop 발행의 publishId 조회
  const getShopPublishId = (productId: number, shopId: number) => {
    const product = products.find((p) => p.id === productId)
    const publishedShop = product?.publishedShops?.find((ps) => ps.shopId === shopId)
    return publishedShop?.publishId
  }

  // 셀 키 생성 (type-productId-targetId)
  const cellKey = (productId: number, targetType: 'shop' | 'channel', targetId: number) =>
    `${targetType}-${productId}-${targetId}`

  // 셀 키 파싱
  const parseCellKey = (key: string) => {
    const [type, productId, targetId] = key.split('-')
    return { type: type as 'shop' | 'channel', productId: Number(productId), targetId: Number(targetId) }
  }

  const handleCellClick = (productId: number, targetType: 'shop' | 'channel', targetId: number) => {
    // 발행된 Shop 셀 클릭 시 취소 확인 모달 표시
    if (isPublished(productId, targetType, targetId)) {
      // Shop 발행만 취소 가능
      if (targetType === 'shop') {
        const product = getProduct(productId)
        const shop = shops.find((s) => s.id === targetId)
        const publishId = getShopPublishId(productId, targetId)

        if (product && shop && publishId) {
          setUnpublishTarget({
            productId,
            productName: product.name,
            shopId: targetId,
            shopName: shop.name,
            publishId,
          })
          setShowUnpublishConfirm(true)
        }
      }
      return
    }

    // 가격이 설정되지 않은 상품은 발행 불가
    if (!hasPrice(productId)) {
      const product = getProduct(productId)
      if (product) {
        setWarningProduct(product)
        setShowPriceWarning(true)
      }
      return
    }

    const key = cellKey(productId, targetType, targetId)
    setSelectedCells((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSelectRow = (productId: number) => {
    // 가격이 설정되지 않은 상품은 발행 불가
    if (!hasPrice(productId)) {
      const product = getProduct(productId)
      if (product) {
        setWarningProduct(product)
        setShowPriceWarning(true)
      }
      return
    }

    // 미발행 셀만 선택 가능 (Shop + 채널)
    const rowKeys: string[] = []

    // Shop 셀
    shops.forEach((shop) => {
      if (!isPublished(productId, 'shop', shop.id)) {
        rowKeys.push(cellKey(productId, 'shop', shop.id))
      }
    })

    // 채널 셀
    channels.forEach((ch) => {
      if (!isPublished(productId, 'channel', ch.id)) {
        rowKeys.push(cellKey(productId, 'channel', ch.id))
      }
    })

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

  const handleSelectColumn = (targetType: 'shop' | 'channel', targetId: number) => {
    // 미발행 셀 + 가격 있는 상품만 선택 가능
    const colKeys = products
      .filter((p) => !isPublished(p.id, targetType, targetId) && hasPrice(p.id))
      .map((p) => cellKey(p.id, targetType, targetId))

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
      // 선택된 셀을 타입별로 그룹화 (Shop / 채널)
      const shopToProducts: Record<number, number[]> = {}
      const channelToProducts: Record<number, number[]> = {}

      selectedCells.forEach((key) => {
        const { type, productId, targetId } = parseCellKey(key)
        if (!isPublished(productId, type, targetId)) {
          if (type === 'shop') {
            if (!shopToProducts[targetId]) shopToProducts[targetId] = []
            shopToProducts[targetId].push(productId)
          } else {
            if (!channelToProducts[targetId]) channelToProducts[targetId] = []
            channelToProducts[targetId].push(productId)
          }
        }
      })

      // 성공한 셀을 추적
      const successfulCells = new Set<string>()
      let totalSuccess = 0
      let totalSkipped = 0
      let totalFailed = 0
      const errorMessages: string[] = []

      // Shop 발행 처리
      for (const [shopId, productIds] of Object.entries(shopToProducts)) {
        if (productIds.length > 0) {
          const response = await fetch('/api/shop/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds, shopId: Number(shopId) }),
          })

          const data = await response.json()

          if (data.results) {
            for (const result of data.results) {
              if (result.status === 'SUCCESS') {
                successfulCells.add(cellKey(result.productId, 'shop', Number(shopId)))
                totalSuccess++
              } else if (result.status === 'SKIPPED') {
                successfulCells.add(cellKey(result.productId, 'shop', Number(shopId)))
                totalSkipped++
              } else if (result.status === 'FAILED') {
                totalFailed++
                if (result.message) {
                  errorMessages.push(result.message)
                }
              }
            }
          } else if (!data.success) {
            totalFailed += productIds.length
            if (data.error) {
              errorMessages.push(data.error)
            }
          }
        }
      }

      // 채널 발행 처리
      for (const [channelId, productIds] of Object.entries(channelToProducts)) {
        if (productIds.length > 0) {
          const response = await fetch('/api/shop/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds, channelId: Number(channelId) }),
          })

          const data = await response.json()

          if (data.results) {
            for (const result of data.results) {
              if (result.status === 'SUCCESS') {
                successfulCells.add(cellKey(result.productId, 'channel', Number(channelId)))
                totalSuccess++
              } else if (result.status === 'SKIPPED') {
                successfulCells.add(cellKey(result.productId, 'channel', Number(channelId)))
                totalSkipped++
              } else if (result.status === 'FAILED') {
                totalFailed++
                if (result.message) {
                  errorMessages.push(result.message)
                }
              }
            }
          } else if (!data.success) {
            totalFailed += productIds.length
            if (data.error) {
              errorMessages.push(data.error)
            }
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
        // 중복 제거 후 첫 번째 에러 메시지 표시
        const uniqueErrors = [...new Set(errorMessages)]
        const firstError = uniqueErrors[0]
        if (firstError) {
          toast.error(`발행 실패: ${firstError}`)
        } else {
          toast.warning(`발행 결과: 성공 ${totalSuccess}개, 건너뜀 ${totalSkipped}개, 실패 ${totalFailed}개`)
        }
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

  // 발행 취소 처리
  const handleUnpublish = async () => {
    if (!unpublishTarget) return
    if (isUnpublishing) return

    setIsUnpublishing(true)
    try {
      const response = await fetch(`/api/shop/publish?ids=${unpublishTarget.publishId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('발행이 취소되었습니다.')
        setShowUnpublishConfirm(false)
        setUnpublishTarget(null)
        loadProducts()
      } else {
        // 주문/문의가 있어서 삭제 불가한 경우
        if (data.cannotDelete && data.cannotDelete.length > 0) {
          const item = data.cannotDelete[0]
          toast.error(`발행 취소 불가: ${item.reason}이 있습니다.`)
        } else {
          toast.error(data.error || '발행 취소에 실패했습니다.')
        }
      }
    } catch (error) {
      console.error('발행 취소 실패:', error)
      toast.error('발행 취소 중 오류가 발생했습니다.')
    } finally {
      setIsUnpublishing(false)
    }
  }

  const formatPrice = (price: number | null) => (!price ? '-' : `₩${price.toLocaleString()}`)

  const selectedUnpublishedCount = selectedCells.size

  // 통계 계산
  const stats = useMemo(() => {
    const totalProducts = products.length
    const totalTargets = channels.length + shops.length
    const totalCells = products.length * totalTargets
    let publishedCells = 0

    products.forEach((product) => {
      // Shop 발행 카운트
      shops.forEach((shop) => {
        if (isPublished(product.id, 'shop', shop.id)) {
          publishedCells++
        }
      })
      // 채널 발행 카운트
      channels.forEach((channel) => {
        if (isPublished(product.id, 'channel', channel.id)) {
          publishedCells++
        }
      })
    })

    return {
      totalProducts,
      totalTargets,
      totalShops: shops.length,
      totalChannels: channels.length,
      publishedCells,
      unpublishedCells: totalCells - publishedCells,
    }
  }, [products, channels, shops])

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200 space-y-4">
            {/* 첫 번째 줄: 범례 + 검색 */}
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
                <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-amber-100 text-amber-700 flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-200 border border-dashed border-amber-400" />
                  가격미설정
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
                    onKeyPress={(e) => e.key === 'Enter' && loadProducts(true)}
                    className="pl-10 w-64"
                  />
                </div>
                <button
                  onClick={() => loadProducts(true)}
                  disabled={isLoading}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={20} className={isLoading ? 'animate-spin text-gray-400' : 'text-gray-600'} />
                </button>
              </div>
            </div>

            {/* 두 번째 줄: 도매밴드 필터 */}
            {wholesaleChannels.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">도매밴드:</span>
                <button
                  onClick={() => {
                    setSelectedWholesaleChannel(null)
                    setCurrentPage(1)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedWholesaleChannel === null
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                {wholesaleChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => {
                      setSelectedWholesaleChannel(channel.id)
                      setCurrentPage(1)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedWholesaleChannel === channel.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {channel.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 매트릭스 테이블 */}
          {isLoading || isLoadingChannels || isLoadingShops ? (
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
                    {groupedTargets.map((group) => (
                      <th
                        key={group.platform}
                        colSpan={group.items.length}
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
                    {groupedTargets.map((group) =>
                      group.items.map((item) => (
                        <th
                          key={`${group.type}-${item.id}`}
                          className="border-b border-gray-200 p-1 min-w-[80px] cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSelectColumn(group.type, item.id)}
                          title={`${item.name} 전체 선택/해제`}
                        >
                          <div className="text-xs text-gray-600 truncate max-w-[80px] mx-auto" title={item.name}>
                            {item.name.length > 8 ? item.name.slice(0, 8) + '...' : item.name}
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
                          </div>
                        </div>
                      </td>
                      {groupedTargets.map((group) =>
                        group.items.map((item) => {
                          const published = isPublished(product.id, group.type, item.id)
                          const selected = selectedCells.has(cellKey(product.id, group.type, item.id))
                          const priceSet = hasPrice(product.id)
                          const isShopPublished = published && group.type === 'shop'

                          return (
                            <td
                              key={`${group.type}-${item.id}`}
                              className="border-b border-gray-200 p-1 text-center"
                            >
                              <button
                                onClick={() => handleCellClick(product.id, group.type, item.id)}
                                className={`w-8 h-8 rounded transition-all ${
                                  selected
                                    ? 'bg-purple-500 hover:bg-purple-600 cursor-pointer'
                                    : isShopPublished
                                    ? 'bg-green-500 hover:bg-green-600 cursor-pointer'
                                    : published
                                    ? 'bg-green-500 cursor-not-allowed'
                                    : !priceSet
                                    ? 'bg-amber-100 hover:bg-amber-200 cursor-pointer border-2 border-dashed border-amber-300'
                                    : 'bg-gray-200 hover:bg-gray-300 cursor-pointer'
                                }`}
                                title={`${product.name} → ${item.name}: ${
                                  isShopPublished ? '발행됨 (클릭하여 취소)' : published ? '발행됨' : !priceSet ? '가격 미설정 (설정 필요)' : '미발행'
                                }`}
                              >
                                {published && <Check size={16} className="text-white mx-auto" />}
                                {!published && !priceSet && <AlertTriangle size={12} className="text-amber-500 mx-auto" />}
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

          {/* 페이징 */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                총 {totalProducts}개 중 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalProducts)}개 표시
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* 가격 미설정 경고 모달 */}
      {showPriceWarning && warningProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowPriceWarning(false)
              setWarningProduct(null)
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* 헤더 */}
            <div className="bg-amber-50 p-6 border-b border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-full">
                  <AlertTriangle size={24} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">가격 정보 필요</h3>
                  <p className="text-sm text-gray-600">상품 발행을 위해 가격 설정이 필요합니다</p>
                </div>
              </div>
            </div>

            {/* 콘텐츠 */}
            <div className="p-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-4">
                {warningProduct.thumbnailUrl ? (
                  <img
                    src={warningProduct.thumbnailUrl}
                    alt={warningProduct.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                    <Package size={24} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{warningProduct.name}</p>
                  <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                    <XCircle size={14} />
                    가격 미설정
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                이 상품은 가격 정보가 설정되어 있지 않아 발행할 수 없습니다.
                상품 상세 페이지에서 옵션과 가격을 설정해주세요.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowPriceWarning(false)
                    setWarningProduct(null)
                  }}
                >
                  닫기
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    router.push(`/product/detail/${warningProduct.id}`)
                  }}
                >
                  <ExternalLink size={16} className="mr-2" />
                  가격 설정하기
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 발행 취소 확인 모달 */}
      {showUnpublishConfirm && unpublishTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!isUnpublishing) {
                setShowUnpublishConfirm(false)
                setUnpublishTarget(null)
              }
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* 헤더 */}
            <div className="bg-red-50 p-6 border-b border-red-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-full">
                  <Trash2 size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">발행 취소</h3>
                  <p className="text-sm text-gray-600">쇼핑몰에서 상품을 제거합니다</p>
                </div>
              </div>
            </div>

            {/* 콘텐츠 */}
            <div className="p-6">
              <div className="p-4 bg-gray-50 rounded-xl mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">상품</span>
                  <span className="font-medium text-gray-900 truncate max-w-[200px]">{unpublishTarget.productName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">쇼핑몰</span>
                  <span className="font-medium text-gray-900">{unpublishTarget.shopName}</span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                이 상품의 발행을 취소하시겠습니까?
                <br />
                <span className="text-red-500">
                  주문 또는 문의가 있는 상품은 취소할 수 없습니다.
                </span>
              </p>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowUnpublishConfirm(false)
                    setUnpublishTarget(null)
                  }}
                  disabled={isUnpublishing}
                >
                  닫기
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleUnpublish}
                  loading={isUnpublishing}
                >
                  <Trash2 size={16} className="mr-2" />
                  발행 취소
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
