'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
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
  Loader2,
  AlertOctagon,
  X,
  Clock,
  StopCircle,
} from 'lucide-react'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import { checkExtensionInstalled, saveSessionViaExtension } from '@/lib/band-extension'

const BandIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
)

interface ChannelShop {
  id: number
  name: string
  subdomain: string
  isActive: boolean
}

interface Channel {
  id: number
  name: string
  channelKey: string
  coverUrl: string | null
  platform: string | null
  isActive: boolean
  shop: ChannelShop | null
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

  // 쇼핑몰 미연결 경고 모달
  const [showShopConnectionWarning, setShowShopConnectionWarning] = useState(false)
  const [unconnectedChannels, setUnconnectedChannels] = useState<Channel[]>([])

  // 발행 취소 확인 모달
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false)
  const [unpublishTarget, setUnpublishTarget] = useState<{
    productId: number
    productName: string
    targetType: 'shop' | 'channel'
    targetId: number
    targetName: string
    publishId: number
  } | null>(null)
  const [isUnpublishing, setIsUnpublishing] = useState(false)
  const [unpublishResult, setUnpublishResult] = useState<{
    status: 'idle' | 'success' | 'warning' | 'error'
    message: string
    details?: string
  }>({ status: 'idle', message: '' })

  // 발행 진행 모달 상태
  interface PublishProgressItem {
    productId: number
    productName: string
    targetId: number
    targetName: string
    targetType: 'shop' | 'channel'
    status: 'pending' | 'publishing' | 'success' | 'failed'
    message?: string
    // 상세 진행 상태 (SSE용)
    stage?: string
    stageLabel?: string
    imageProgress?: {
      current: number
      total: number
    }
    publishMethod?: 'playwright' | 'api'
  }
  const [showPublishProgress, setShowPublishProgress] = useState(false)
  const [publishProgressItems, setPublishProgressItems] = useState<PublishProgressItem[]>([])
  const [currentPublishIndex, setCurrentPublishIndex] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)
  const [publishCancelled, setPublishCancelled] = useState(false)

  // 취소 상태 추적 (async 함수에서 즉시 확인 가능)
  const publishCancelledRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 세션 만료 모달 상태
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false)
  const [expiredChannelInfo, setExpiredChannelInfo] = useState<{
    channelId: number
    channelName: string
  } | null>(null)

  // Extension 세션 저장 후 재시도 관련 상태
  const [extensionAvailable, setExtensionAvailable] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryMessage, setRetryMessage] = useState('')
  const [failedPublishItems, setFailedPublishItems] = useState<PublishProgressItem[]>([])
  const [autoRetryTriggered, setAutoRetryTriggered] = useState(false) // 자동 재시도 트리거 플래그
  const autoRetryAttemptedRef = useRef(false) // 자동 재시도 시도 여부 (무한 루프 방지)

  // 페이지 이탈 경고 및 작업 중단 (발행 중일 때)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isPublishing) {
        e.preventDefault()
        e.returnValue = '발행이 진행 중입니다. 페이지를 나가면 발행이 취소될 수 있습니다.'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isPublishing])

  // 컴포넌트 언마운트 시 (페이지 이탈 시) 발행 작업 중단
  useEffect(() => {
    return () => {
      // 컴포넌트가 언마운트될 때 진행 중인 작업 취소
      if (abortControllerRef.current) {
        console.log('[페이지 이탈] 진행 중인 발행 작업 중단')
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      // 취소 상태로 설정하여 진행 중인 루프 중단
      publishCancelledRef.current = true
    }
  }, [])

  // 초기 로드
  useEffect(() => {
    loadChannels()
    loadShops()
    // Extension 설치 확인
    checkExtensionInstalled().then(setExtensionAvailable)
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

  const loadProducts = useCallback(async (resetPage = false) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- searchTerm은 Enter 키를 눌러야 적용됨
  }, [currentPage, selectedWholesaleChannel])

  // 페이지/필터 변경 시 상품 로드
  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // 플랫폼별 채널 그룹 (Shop 포함)
  const groupedTargets = useMemo(() => {
    const groups: {
      type: 'shop' | 'channel'
      platform: string
      label: string
      icon: React.ReactNode
      items: (Channel | Shop)[]
      headerBgColor: string
      headerTextColor: string
      cellBgColor: string
      badgeColor: string
    }[] = [
      {
        type: 'shop',
        platform: 'SHOP',
        label: '쇼핑몰',
        icon: <ShoppingCart size={16} />,
        items: [],
        headerBgColor: 'bg-blue-100',
        headerTextColor: 'text-blue-800',
        cellBgColor: 'bg-blue-50/30',
        badgeColor: 'bg-blue-500',
      },
      {
        type: 'channel',
        platform: 'BAND',
        label: '소매밴드',
        icon: <BandIcon size={16} />,
        items: [],
        headerBgColor: 'bg-green-100',
        headerTextColor: 'text-green-800',
        cellBgColor: 'bg-green-50/30',
        badgeColor: 'bg-green-500',
      },
      {
        type: 'channel',
        platform: 'OTHER',
        label: '기타 채널',
        icon: <Store size={16} />,
        items: [],
        headerBgColor: 'bg-gray-100',
        headerTextColor: 'text-gray-700',
        cellBgColor: 'bg-gray-50/30',
        badgeColor: 'bg-gray-500',
      },
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

  // 채널 발행의 publishId 조회
  const getChannelPublishId = (productId: number, channelId: number) => {
    const product = products.find((p) => p.id === productId)
    const publishedChannel = product?.publishedChannels?.find((pc) => pc.channelId === channelId)
    return publishedChannel?.publishId
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
    // 발행된 셀 클릭 시 취소 확인 모달 표시
    if (isPublished(productId, targetType, targetId)) {
      const product = getProduct(productId)

      if (targetType === 'shop') {
        const shop = shops.find((s) => s.id === targetId)
        const publishId = getShopPublishId(productId, targetId)

        if (product && shop && publishId) {
          setUnpublishTarget({
            productId,
            productName: product.name,
            targetType: 'shop',
            targetId,
            targetName: shop.name,
            publishId,
          })
          setShowUnpublishConfirm(true)
        }
      } else {
        // 채널(소매밴드) 발행 취소 - 비활성화 (로직은 유지)
        // 소매밴드는 발행 취소 기능을 막아둠
        return
        /* 취소 로직 (비활성화됨)
        const channel = channels.find((c) => c.id === targetId)
        const publishId = getChannelPublishId(productId, targetId)

        if (product && channel && publishId) {
          setUnpublishTarget({
            productId,
            productName: product.name,
            targetType: 'channel',
            targetId,
            targetName: channel.name,
            publishId,
          })
          setShowUnpublishConfirm(true)
        }
        */
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

  // 발행 취소 핸들러
  const handleCancelPublish = () => {
    if (!isPublishing) return

    // 즉시 취소 상태 설정 (ref는 async 함수에서 바로 확인 가능)
    publishCancelledRef.current = true
    setPublishCancelled(true)
    setIsCancelling(true)

    // 진행 중인 SSE fetch 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      console.log('[발행 취소] SSE 스트림 중단됨')
    }

    // 대기 중인 항목들을 취소됨 상태로 변경
    setPublishProgressItems((prev) =>
      prev.map((item) =>
        item.status === 'pending' || item.status === 'publishing'
          ? { ...item, status: 'failed' as const, message: '사용자에 의해 취소됨' }
          : item
      )
    )

    // 선택된 셀 모두 초기화 (다시 발행하려면 새로 선택해야 함)
    setSelectedCells(new Set())

    // 발행 상태 종료
    setIsPublishing(false)
    setIsCancelling(false)
  }

  const handlePublishSelected = async () => {
    if (selectedCells.size === 0) return
    if (isPublishing) return  // 중복 호출 방지

    // 소매밴드(채널) 발행 시 쇼핑몰 연결 여부 체크
    const selectedChannelIds = new Set<number>()
    selectedCells.forEach((key) => {
      const { type, targetId } = parseCellKey(key)
      if (type === 'channel') {
        selectedChannelIds.add(targetId)
      }
    })

    // 쇼핑몰 미연결 채널 확인
    const channelsWithoutShop = channels.filter(
      (ch) => selectedChannelIds.has(ch.id) && !ch.shop
    )

    if (channelsWithoutShop.length > 0) {
      setUnconnectedChannels(channelsWithoutShop)
      setShowShopConnectionWarning(true)
      return
    }

    // 발행 진행 항목 준비
    const progressItems: PublishProgressItem[] = []

    selectedCells.forEach((key) => {
      const { type, productId, targetId } = parseCellKey(key)
      if (!isPublished(productId, type, targetId)) {
        const product = getProduct(productId)
        let targetName = ''

        if (type === 'shop') {
          const shop = shops.find((s) => s.id === targetId)
          targetName = shop?.name || `Shop ${targetId}`
        } else {
          const channel = channels.find((c) => c.id === targetId)
          targetName = channel?.name || `채널 ${targetId}`
        }

        progressItems.push({
          productId,
          productName: product?.name || `상품 ${productId}`,
          targetId,
          targetName,
          targetType: type,
          status: 'pending',
        })
      }
    })

    if (progressItems.length === 0) return

    // 취소 상태 및 자동 재시도 상태 초기화
    publishCancelledRef.current = false
    autoRetryAttemptedRef.current = false
    setPublishCancelled(false)
    setIsCancelling(false)
    setAutoRetryTriggered(false)

    // 발행 진행 모달 표시
    setPublishProgressItems(progressItems)
    setCurrentPublishIndex(0)
    setShowPublishProgress(true)
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
      let processedIndex = 0

      // Shop 발행 처리
      for (const [shopId, productIds] of Object.entries(shopToProducts)) {
        // 취소 확인
        if (publishCancelledRef.current) {
          console.log('[발행 취소] Shop 발행 루프 중단')
          break
        }

        if (productIds.length > 0) {
          // 현재 발행 중인 항목들 업데이트
          const shopItems = progressItems.filter(
            (item) => item.targetType === 'shop' && item.targetId === Number(shopId)
          )
          shopItems.forEach((item) => {
            const idx = progressItems.findIndex(
              (p) => p.productId === item.productId && p.targetId === item.targetId && p.targetType === item.targetType
            )
            if (idx !== -1) {
              setPublishProgressItems((prev) => {
                const updated = [...prev]
                updated[idx] = { ...updated[idx], status: 'publishing' }
                return updated
              })
              setCurrentPublishIndex(idx)
            }
          })

          try {
            // AbortController 생성 (취소 지원)
            const shopAbortController = new AbortController()
            abortControllerRef.current = shopAbortController

            const response = await fetch('/api/shop/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productIds, shopId: Number(shopId) }),
              signal: shopAbortController.signal,
            })

            const data = await response.json()

            if (data.results) {
              for (const result of data.results) {
                const itemIdx = progressItems.findIndex(
                  (p) => p.productId === result.productId && p.targetId === Number(shopId) && p.targetType === 'shop'
                )

                if (result.status === 'SUCCESS') {
                  successfulCells.add(cellKey(result.productId, 'shop', Number(shopId)))
                  totalSuccess++
                  if (itemIdx !== -1) {
                    setPublishProgressItems((prev) => {
                      const updated = [...prev]
                      updated[itemIdx] = { ...updated[itemIdx], status: 'success' }
                      return updated
                    })
                  }
                } else if (result.status === 'SKIPPED') {
                  successfulCells.add(cellKey(result.productId, 'shop', Number(shopId)))
                  totalSkipped++
                  if (itemIdx !== -1) {
                    setPublishProgressItems((prev) => {
                      const updated = [...prev]
                      updated[itemIdx] = { ...updated[itemIdx], status: 'success', message: '이미 발행됨' }
                      return updated
                    })
                  }
                } else if (result.status === 'FAILED') {
                  totalFailed++
                  if (result.message) {
                    errorMessages.push(result.message)
                  }
                  if (itemIdx !== -1) {
                    setPublishProgressItems((prev) => {
                      const updated = [...prev]
                      updated[itemIdx] = { ...updated[itemIdx], status: 'failed', message: result.message }
                      return updated
                    })
                  }
                }
                processedIndex++
              }
            } else if (!data.success) {
              totalFailed += productIds.length
              if (data.error) {
                errorMessages.push(data.error)
              }
              // 모든 항목 실패 처리
              shopItems.forEach((item) => {
                const idx = progressItems.findIndex(
                  (p) => p.productId === item.productId && p.targetId === item.targetId && p.targetType === item.targetType
                )
                if (idx !== -1) {
                  setPublishProgressItems((prev) => {
                    const updated = [...prev]
                    updated[idx] = { ...updated[idx], status: 'failed', message: data.error }
                    return updated
                  })
                }
              })
            }
          } catch (error: any) {
            // AbortError는 사용자 취소 또는 페이지 이탈이므로 별도 처리
            if (error.name === 'AbortError' || publishCancelledRef.current) {
              console.log('[발행 취소] Shop 발행 요청 취소됨')
              break
            } else {
              console.error('Shop 발행 오류:', error)
              totalFailed += productIds.length
              errorMessages.push(error.message || 'Shop 발행 중 오류가 발생했습니다.')
              // 모든 항목 실패 처리
              shopItems.forEach((item) => {
                const idx = progressItems.findIndex(
                  (p) => p.productId === item.productId && p.targetId === item.targetId && p.targetType === item.targetType
                )
                if (idx !== -1) {
                  setPublishProgressItems((prev) => {
                    const updated = [...prev]
                    updated[idx] = { ...updated[idx], status: 'failed', message: error.message }
                    return updated
                  })
                }
              })
            }
          }
        }
      }

      // 채널 발행 처리 (SSE 스트리밍)
      for (const [channelId, productIds] of Object.entries(channelToProducts)) {
        // 취소 확인
        if (publishCancelledRef.current) {
          console.log('[발행 취소] 채널 발행 루프 중단')
          break
        }

        if (productIds.length > 0) {
          // 현재 발행 중인 항목들을 대기 상태로 설정
          const channelItems = progressItems.filter(
            (item) => item.targetType === 'channel' && item.targetId === Number(channelId)
          )

          // SSE 스트리밍으로 발행
          try {
            // AbortController 생성 (취소 지원)
            const abortController = new AbortController()
            abortControllerRef.current = abortController

            const response = await fetch('/api/shop/publish/stream', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productIds, channelId: Number(channelId) }),
              signal: abortController.signal,
            })

            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || '발행 요청 실패')
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('스트림을 읽을 수 없습니다.')

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
              // 취소 확인
              if (publishCancelledRef.current) {
                console.log('[발행 취소] SSE 스트림 읽기 중단')
                reader.cancel()
                break
              }

              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const event = JSON.parse(line.slice(6))

                    if (event.type === 'product_start') {
                      // 상품 발행 시작
                      const itemIdx = progressItems.findIndex(
                        (p) => p.productId === event.data.progress.productId &&
                               p.targetId === Number(channelId) &&
                               p.targetType === 'channel'
                      )
                      if (itemIdx !== -1) {
                        setPublishProgressItems((prev) => {
                          const updated = [...prev]
                          updated[itemIdx] = {
                            ...updated[itemIdx],
                            status: 'publishing',
                            stage: event.data.progress.stage,
                            stageLabel: event.data.progress.stageLabel,
                            imageProgress: event.data.progress.imageProgress,
                          }
                          return updated
                        })
                        setCurrentPublishIndex(itemIdx)
                      }
                    } else if (event.type === 'stage_update' || event.type === 'image_progress') {
                      // 단계 변경 또는 이미지 진행률 업데이트
                      const itemIdx = progressItems.findIndex(
                        (p) => p.productId === event.data.progress.productId &&
                               p.targetId === Number(channelId) &&
                               p.targetType === 'channel'
                      )
                      if (itemIdx !== -1) {
                        setPublishProgressItems((prev) => {
                          const updated = [...prev]
                          updated[itemIdx] = {
                            ...updated[itemIdx],
                            stage: event.data.progress.stage,
                            stageLabel: event.data.progress.stageLabel,
                            imageProgress: event.data.progress.imageProgress,
                            publishMethod: event.data.progress.publishMethod,
                          }
                          return updated
                        })
                      }
                    } else if (event.type === 'product_complete') {
                      // 상품 발행 완료
                      const progress = event.data.progress
                      const itemIdx = progressItems.findIndex(
                        (p) => p.productId === progress.productId &&
                               p.targetId === Number(channelId) &&
                               p.targetType === 'channel'
                      )

                      if (progress.stage === 'completed') {
                        successfulCells.add(cellKey(progress.productId, 'channel', Number(channelId)))
                        totalSuccess++
                        if (itemIdx !== -1) {
                          setPublishProgressItems((prev) => {
                            const updated = [...prev]
                            updated[itemIdx] = {
                              ...updated[itemIdx],
                              status: 'success',
                              stage: progress.stage,
                              stageLabel: progress.stageLabel,
                              imageProgress: progress.imageProgress,
                              publishMethod: progress.publishMethod,
                            }
                            return updated
                          })
                        }
                      } else if (progress.stage === 'skipped') {
                        successfulCells.add(cellKey(progress.productId, 'channel', Number(channelId)))
                        totalSkipped++
                        if (itemIdx !== -1) {
                          setPublishProgressItems((prev) => {
                            const updated = [...prev]
                            updated[itemIdx] = {
                              ...updated[itemIdx],
                              status: 'success',
                              message: '이미 발행됨',
                              stage: progress.stage,
                              stageLabel: progress.stageLabel,
                            }
                            return updated
                          })
                        }
                      } else if (progress.stage === 'failed') {
                        totalFailed++
                        if (progress.error) {
                          errorMessages.push(progress.error)

                          // 세션 만료 감지 시 자동 재시도 또는 모달 표시
                          const isSessionError = progress.error.includes('세션') &&
                            (progress.error.includes('만료') || progress.error.includes('없'))
                          if (isSessionError && !showSessionExpiredModal && !autoRetryAttemptedRef.current) {
                            const channel = channels.find(ch => ch.id === Number(channelId))
                            setExpiredChannelInfo({
                              channelId: Number(channelId),
                              channelName: channel?.name || `채널 ${channelId}`
                            })
                            // 세션 만료로 실패한 채널의 모든 pending/failed 항목 저장 (재시도용)
                            const failedItems = progressItems.filter(
                              (p) => p.targetType === 'channel' &&
                                     p.targetId === Number(channelId) &&
                                     (p.status === 'pending' || p.status === 'failed' || p.status === 'publishing')
                            )
                            setFailedPublishItems(failedItems)

                            // Extension 설치되어 있으면 자동 재시도, 아니면 모달 표시
                            if (extensionAvailable) {
                              console.log('[발행] 세션 만료 감지 - 자동 재시도 시작')
                              setAutoRetryTriggered(true)
                            } else {
                              setShowSessionExpiredModal(true)
                            }
                          }
                        }
                        if (itemIdx !== -1) {
                          setPublishProgressItems((prev) => {
                            const updated = [...prev]
                            updated[itemIdx] = {
                              ...updated[itemIdx],
                              status: 'failed',
                              message: progress.error,
                              stage: progress.stage,
                              stageLabel: progress.stageLabel,
                            }
                            return updated
                          })
                        }
                      }
                      processedIndex++
                    } else if (event.type === 'error') {
                      // 에러 발생
                      errorMessages.push(event.data.error)
                    }
                  } catch (parseError) {
                    console.error('SSE 파싱 오류:', parseError)
                  }
                }
              }
            }
          } catch (error: any) {
            // AbortError는 사용자 취소이므로 별도 처리
            if (error.name === 'AbortError' || publishCancelledRef.current) {
              console.log('[발행 취소] SSE 스트림 취소됨')
              // 취소된 경우 실패 처리하지 않음 (handleCancelPublish에서 이미 처리)
            } else {
              console.error('SSE 스트림 오류:', error)
              totalFailed += productIds.length
              errorMessages.push(error.message || '발행 중 오류가 발생했습니다.')
              // 모든 항목 실패 처리
              channelItems.forEach((item) => {
                const idx = progressItems.findIndex(
                  (p) => p.productId === item.productId && p.targetId === item.targetId && p.targetType === item.targetType
                )
                if (idx !== -1) {
                  setPublishProgressItems((prev) => {
                    const updated = [...prev]
                    updated[idx] = { ...updated[idx], status: 'failed', message: error.message }
                    return updated
                  })
                }
              })
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

      // 발행 결과는 모달에서 확인하므로 토스트 제거
      loadProducts()
    } catch (error) {
      console.error('발행 실패:', error)
      toast.error('발행 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsPublishing(false)
      // 모달은 사용자가 닫을 때까지 유지
    }
  }

  // 자동 재시도 핸들러 (세션 만료 시 자동으로 실행)
  const handleAutoRetry = useCallback(async () => {
    if (!expiredChannelInfo || failedPublishItems.length === 0) {
      console.log('[자동 재시도] 필요한 정보 없음, 건너뜀')
      return
    }

    console.log(`[자동 재시도] Extension으로 세션 저장 시작... (${failedPublishItems.length}개 항목)`)

    // 진행 모달에 메시지 표시
    setPublishProgressItems((prev) =>
      prev.map((item) =>
        item.status === 'failed'
          ? { ...item, message: 'Extension에서 세션 저장 중...' }
          : item
      )
    )

    try {
      // 1. Extension으로 세션 저장
      const saveResult = await saveSessionViaExtension()

      if (!saveResult.success) {
        console.error('[자동 재시도] 세션 저장 실패:', saveResult.error)
        // 실패 시 모달 표시
        setShowSessionExpiredModal(true)
        toast.error(`자동 세션 저장 실패: ${saveResult.error}`)
        return
      }

      console.log('[자동 재시도] 세션 저장 완료, 재발행 시작...')
      toast.info('세션 저장 완료! 재시도 중...')

      // 2. 잠시 대기 (서버에 세션 저장 반영 시간)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 3. 실패한 항목들 재시도
      const channelId = expiredChannelInfo.channelId
      const productIds = failedPublishItems.map(item => item.productId)

      // 발행 진행 모달 상태 리셋
      setPublishProgressItems(failedPublishItems.map(item => ({ ...item, status: 'pending' as const, message: undefined })))
      setIsPublishing(true)
      publishCancelledRef.current = false

      // SSE 스트리밍으로 재발행
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const response = await fetch('/api/shop/publish/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, channelId }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '재시도 요청 실패')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('스트림을 읽을 수 없습니다.')

      const decoder = new TextDecoder()
      let buffer = ''
      let successCount = 0
      let failCount = 0

      while (true) {
        if (publishCancelledRef.current) {
          reader.cancel()
          break
        }

        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))

              if (event.type === 'product_start' || event.type === 'stage_update' || event.type === 'image_progress') {
                const itemIdx = failedPublishItems.findIndex(
                  (p) => p.productId === event.data.progress.productId
                )
                if (itemIdx !== -1) {
                  setPublishProgressItems((prev) => {
                    const updated = [...prev]
                    updated[itemIdx] = {
                      ...updated[itemIdx],
                      status: 'publishing',
                      stage: event.data.progress.stage,
                      stageLabel: event.data.progress.stageLabel,
                      imageProgress: event.data.progress.imageProgress,
                      publishMethod: event.data.progress.publishMethod,
                    }
                    return updated
                  })
                  setCurrentPublishIndex(itemIdx)
                }
              } else if (event.type === 'product_complete') {
                const progress = event.data.progress
                const itemIdx = failedPublishItems.findIndex(
                  (p) => p.productId === progress.productId
                )

                if (progress.stage === 'completed' || progress.stage === 'skipped') {
                  successCount++
                  if (itemIdx !== -1) {
                    setPublishProgressItems((prev) => {
                      const updated = [...prev]
                      updated[itemIdx] = {
                        ...updated[itemIdx],
                        status: 'success',
                        stage: progress.stage,
                        stageLabel: progress.stageLabel,
                      }
                      return updated
                    })
                  }
                } else if (progress.stage === 'failed') {
                  failCount++
                  if (itemIdx !== -1) {
                    setPublishProgressItems((prev) => {
                      const updated = [...prev]
                      updated[itemIdx] = {
                        ...updated[itemIdx],
                        status: 'failed',
                        message: progress.error,
                        stage: progress.stage,
                        stageLabel: progress.stageLabel,
                      }
                      return updated
                    })
                  }
                }
              }
            } catch (parseError) {
              console.error('SSE 파싱 오류:', parseError)
            }
          }
        }
      }

      // 완료
      loadProducts()
      if (successCount > 0) {
        toast.success(`자동 재시도 완료: ${successCount}개 성공` + (failCount > 0 ? `, ${failCount}개 실패` : ''))
      }

      // 모든 항목이 성공한 경우에만 failedPublishItems 초기화
      if (failCount === 0) {
        setFailedPublishItems([])
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[자동 재시도] 실패:', error)
        toast.error(`자동 재시도 실패: ${error.message}`)
        // 실패 시 모달 표시 (failedPublishItems는 유지하여 수동 재시도 가능하게 함)
        setShowSessionExpiredModal(true)
      }
    } finally {
      setIsPublishing(false)
      // failedPublishItems는 성공 시에만 초기화 (catch에서 모달 표시 시 유지)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadProducts는 항상 최신 상태를 사용
  }, [expiredChannelInfo, failedPublishItems, toast])

  // 자동 재시도 트리거 감지 - Extension 설치 시 자동으로 세션 저장 후 재시도
  useEffect(() => {
    if (autoRetryTriggered && extensionAvailable && failedPublishItems.length > 0 && !autoRetryAttemptedRef.current) {
      autoRetryAttemptedRef.current = true
      setAutoRetryTriggered(false)
      // 자동 재시도 실행
      handleAutoRetry()
    }
  }, [autoRetryTriggered, extensionAvailable, failedPublishItems, handleAutoRetry])

  // 세션 저장 후 재시도 핸들러 (수동 - 모달에서 버튼 클릭 시)
  const handleRetryWithSessionSave = async () => {
    if (!expiredChannelInfo || failedPublishItems.length === 0) return
    if (isRetrying) return

    setIsRetrying(true)
    setRetryMessage('Extension에서 세션 저장 중...')

    try {
      // 1. Extension으로 세션 저장
      const saveResult = await saveSessionViaExtension()

      if (!saveResult.success) {
        setRetryMessage(`세션 저장 실패: ${saveResult.error}`)
        setTimeout(() => setRetryMessage(''), 3000)
        return
      }

      setRetryMessage('세션 저장 완료! 발행 재시도 중...')

      // 2. 잠시 대기 (서버에 세션 저장 반영 시간)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 3. 실패한 항목들 재시도
      const channelId = expiredChannelInfo.channelId
      const productIds = failedPublishItems.map(item => item.productId)

      // 발행 진행 모달 다시 표시
      setShowSessionExpiredModal(false)
      setPublishProgressItems(failedPublishItems.map(item => ({ ...item, status: 'pending' as const })))
      setShowPublishProgress(true)
      setIsPublishing(true)
      publishCancelledRef.current = false

      // SSE 스트리밍으로 재발행
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const response = await fetch('/api/shop/publish/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, channelId }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '재시도 요청 실패')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('스트림을 읽을 수 없습니다.')

      const decoder = new TextDecoder()
      let buffer = ''
      let successCount = 0
      let failCount = 0

      while (true) {
        if (publishCancelledRef.current) {
          reader.cancel()
          break
        }

        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))

              if (event.type === 'product_start' || event.type === 'stage_update' || event.type === 'image_progress') {
                const itemIdx = failedPublishItems.findIndex(
                  (p) => p.productId === event.data.progress.productId
                )
                if (itemIdx !== -1) {
                  setPublishProgressItems((prev) => {
                    const updated = [...prev]
                    updated[itemIdx] = {
                      ...updated[itemIdx],
                      status: 'publishing',
                      stage: event.data.progress.stage,
                      stageLabel: event.data.progress.stageLabel,
                      imageProgress: event.data.progress.imageProgress,
                      publishMethod: event.data.progress.publishMethod,
                    }
                    return updated
                  })
                  setCurrentPublishIndex(itemIdx)
                }
              } else if (event.type === 'product_complete') {
                const progress = event.data.progress
                const itemIdx = failedPublishItems.findIndex(
                  (p) => p.productId === progress.productId
                )

                if (progress.stage === 'completed' || progress.stage === 'skipped') {
                  successCount++
                  if (itemIdx !== -1) {
                    setPublishProgressItems((prev) => {
                      const updated = [...prev]
                      updated[itemIdx] = {
                        ...updated[itemIdx],
                        status: 'success',
                        stage: progress.stage,
                        stageLabel: progress.stageLabel,
                      }
                      return updated
                    })
                  }
                } else if (progress.stage === 'failed') {
                  failCount++
                  if (itemIdx !== -1) {
                    setPublishProgressItems((prev) => {
                      const updated = [...prev]
                      updated[itemIdx] = {
                        ...updated[itemIdx],
                        status: 'failed',
                        message: progress.error,
                        stage: progress.stage,
                        stageLabel: progress.stageLabel,
                      }
                      return updated
                    })
                  }
                }
              }
            } catch (parseError) {
              console.error('SSE 파싱 오류:', parseError)
            }
          }
        }
      }

      // 완료
      loadProducts()
      toast.success(`재시도 완료: ${successCount}개 성공, ${failCount}개 실패`)

      // 모든 항목이 성공한 경우에만 failedPublishItems 초기화
      if (failCount === 0) {
        setFailedPublishItems([])
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('재시도 실패:', error)
        setRetryMessage(`재시도 실패: ${error.message}`)
        setTimeout(() => setRetryMessage(''), 3000)
        // 실패 시 모달 다시 표시하여 재시도 가능하게 함
        setShowSessionExpiredModal(true)
      }
    } finally {
      setIsRetrying(false)
      setIsPublishing(false)
      // failedPublishItems는 성공 시에만 초기화
    }
  }

  // 발행 취소 처리
  const handleUnpublish = async () => {
    if (!unpublishTarget) return
    if (isUnpublishing) return

    setIsUnpublishing(true)
    setUnpublishResult({ status: 'idle', message: '' })

    try {
      const response = await fetch(`/api/shop/publish?ids=${unpublishTarget.publishId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        // Band 삭제 에러가 있는 경우 (DB는 삭제됨)
        if (data.bandDeleteErrors && data.bandDeleteErrors.length > 0) {
          setUnpublishResult({
            status: 'warning',
            message: '발행 취소 완료 (밴드 게시물 삭제 실패)',
            details: data.bandDeleteErrors[0],
          })
        } else {
          setUnpublishResult({
            status: 'success',
            message: '발행이 취소되었습니다.',
          })
        }
        loadProducts()
      } else {
        // 완전 실패
        if (data.cannotDelete && data.cannotDelete.length > 0) {
          const item = data.cannotDelete[0]
          setUnpublishResult({
            status: 'error',
            message: '발행 취소 불가',
            details: `${item.reason}이 있어 취소할 수 없습니다.`,
          })
        } else {
          setUnpublishResult({
            status: 'error',
            message: '발행 취소 실패',
            details: data.error || '알 수 없는 오류가 발생했습니다.',
          })
        }
      }
    } catch (error) {
      console.error('발행 취소 실패:', error)
      setUnpublishResult({
        status: 'error',
        message: '발행 취소 실패',
        details: '네트워크 오류가 발생했습니다.',
      })
    } finally {
      setIsUnpublishing(false)
    }
  }

  // 발행 취소 모달 닫기
  const closeUnpublishModal = () => {
    setShowUnpublishConfirm(false)
    setUnpublishTarget(null)
    setUnpublishResult({ status: 'idle', message: '' })
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">발행</h1>
          <p className="text-gray-600">
            상품을 선택하여 채널, 쇼핑몰에 발행합니다. 셀을 클릭하여 선택하고 발행 버튼을 누르세요.
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
                <p className="text-sm text-gray-500">상품</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
              </div>
            </div>
          </div>
          {/* 쇼핑몰 카드 */}
          <div className="bg-white rounded-lg shadow-sm border-2 border-blue-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShoppingCart size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">쇼핑몰</p>
                <p className="text-2xl font-bold text-blue-700">{stats.totalShops}</p>
              </div>
            </div>
          </div>
          {/* 소매채널 카드 */}
          <div className="bg-white rounded-lg shadow-sm border-2 border-green-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <BandIcon size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-600 font-medium">소매채널</p>
                <p className="text-2xl font-bold text-green-700">{stats.totalChannels}</p>
              </div>
            </div>
          </div>
          {/* 발행 현황 카드 */}
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
          {/* 선택 발행 카드 */}
          <button
            onClick={handlePublishSelected}
            disabled={selectedUnpublishedCount === 0 || isPublishing}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left transition-colors ${
              selectedUnpublishedCount > 0 && !isPublishing
                ? 'hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${selectedUnpublishedCount > 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <Send size={24} className={selectedUnpublishedCount > 0 ? 'text-blue-600' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-sm text-gray-500">선택 발행</p>
                <p className={`text-lg font-bold ${selectedUnpublishedCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
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
                  {/* 그룹 헤더 (쇼핑몰 / 소매밴드 구분) */}
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-100 border-b-2 border-r-2 border-gray-300 p-3 text-left min-w-[100px]">
                      <span className="text-sm font-bold text-gray-700">상품</span>
                    </th>
                    {groupedTargets.map((group, groupIndex) => (
                      <th
                        key={group.platform}
                        colSpan={group.items.length}
                        className={`border-b-2 border-gray-300 p-3 text-center ${group.headerBgColor} ${
                          groupIndex < groupedTargets.length - 1 ? 'border-r-2' : ''
                        }`}
                      >
                        <div className={`flex items-center justify-center gap-2 font-bold ${group.headerTextColor}`}>
                          <div className={`p-1.5 rounded-lg ${group.badgeColor} text-white`}>
                            {group.icon}
                          </div>
                          <span className="text-sm">{group.label}</span>
                          <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${group.badgeColor} text-white`}>
                            {group.items.length}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                  {/* 개별 타겟 헤더 */}
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-50 border-b border-r-2 border-gray-300 p-2" />
                    {groupedTargets.map((group, groupIndex) =>
                      group.items.map((item, itemIndex) => (
                        <th
                          key={`${group.type}-${item.id}`}
                          className={`border-b border-gray-200 p-1.5 min-w-[80px] cursor-pointer transition-colors ${group.cellBgColor} hover:opacity-80 ${
                            groupIndex < groupedTargets.length - 1 && itemIndex === group.items.length - 1
                              ? 'border-r-2 border-gray-300'
                              : ''
                          }`}
                          onClick={() => handleSelectColumn(group.type, item.id)}
                          title={`${item.name} 전체 선택/해제`}
                        >
                          <div className={`text-xs font-medium truncate max-w-[80px] mx-auto ${group.headerTextColor}`} title={item.name}>
                            {item.name.length > 8 ? item.name.slice(0, 8) + '...' : item.name}
                          </div>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50/50">
                      <td
                        className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-300 p-2 cursor-pointer hover:bg-gray-100 min-w-[200px] max-w-[300px]"
                        onClick={() => handleSelectRow(product.id)}
                        title="행 전체 선택/해제"
                      >
                        <div className="flex items-center gap-2">
                          {product.thumbnailUrl ? (
                            <img src={product.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Package size={14} className="text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate" title={product.name}>{product.name}</div>
                          </div>
                        </div>
                      </td>
                      {groupedTargets.map((group, groupIndex) =>
                        group.items.map((item, itemIndex) => {
                          const published = isPublished(product.id, group.type, item.id)
                          const selected = selectedCells.has(cellKey(product.id, group.type, item.id))
                          const priceSet = hasPrice(product.id)
                          const isLastInGroup = itemIndex === group.items.length - 1
                          const hasNextGroup = groupIndex < groupedTargets.length - 1

                          return (
                            <td
                              key={`${group.type}-${item.id}`}
                              className={`border-b border-gray-200 p-1 text-center ${group.cellBgColor} ${
                                isLastInGroup && hasNextGroup ? 'border-r-2 border-gray-300' : ''
                              }`}
                            >
                              <button
                                onClick={() => handleCellClick(product.id, group.type, item.id)}
                                className={`w-8 h-8 rounded transition-all ${
                                  selected
                                    ? 'bg-purple-500 hover:bg-purple-600 cursor-pointer ring-2 ring-purple-300'
                                    : published
                                    ? (group.type === 'shop'
                                        ? 'bg-green-500 hover:bg-green-600 cursor-pointer'
                                        : 'bg-green-500 cursor-default')
                                    : !priceSet
                                    ? 'bg-amber-100 hover:bg-amber-200 cursor-pointer border-2 border-dashed border-amber-300'
                                    : 'bg-gray-200 hover:bg-gray-300 cursor-pointer'
                                }`}
                                title={`${product.name} → ${item.name}: ${
                                  published
                                    ? (group.type === 'shop' ? '발행됨 (클릭하여 취소)' : '발행됨')
                                    : !priceSet ? '가격 미설정 (설정 필요)' : '미발행'
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

      {/* 쇼핑몰 미연결 경고 모달 */}
      {showShopConnectionWarning && unconnectedChannels.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowShopConnectionWarning(false)
              setUnconnectedChannels([])
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* 헤더 */}
            <div className="bg-orange-50 p-6 border-b border-orange-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-full">
                  <AlertTriangle size={24} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">쇼핑몰 연결 필요</h3>
                  <p className="text-sm text-gray-600">소매밴드에 쇼핑몰이 연결되어 있지 않습니다</p>
                </div>
              </div>
            </div>

            {/* 콘텐츠 */}
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                다음 소매밴드에 연결된 쇼핑몰이 없습니다:
              </p>
              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                {unconnectedChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    {channel.coverUrl ? (
                      <img
                        src={channel.coverUrl}
                        alt={channel.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                        <BandIcon size={20} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{channel.name}</p>
                      <p className="text-xs text-orange-500">쇼핑몰 미연결</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-600 mb-6">
                소매밴드에 상품을 발행하려면 먼저 쇼핑몰을 연결해주세요.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowShopConnectionWarning(false)
                    setUnconnectedChannels([])
                  }}
                >
                  닫기
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    router.push('/sourcing/channel/list')
                  }}
                >
                  <ExternalLink size={16} className="mr-2" />
                  채널 관리
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 세션 만료 알림 모달 */}
      {showSessionExpiredModal && expiredChannelInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isRetrying && setShowSessionExpiredModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* 헤더 */}
            <div className="bg-amber-50 p-6 border-b border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-full">
                  <Clock size={24} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">밴드 로그인 세션 만료</h3>
                  <p className="text-sm text-gray-600">
                    채널 세션이 만료되어 발행할 수 없습니다
                  </p>
                </div>
              </div>
            </div>

            {/* 콘텐츠 */}
            <div className="p-6">
              <div className="p-4 bg-gray-50 rounded-xl mb-4">
                <div className="flex items-center gap-3">
                  <BandIcon size={20} className="text-amber-600" />
                  <div>
                    <p className="font-medium text-gray-900">{expiredChannelInfo.channelName}</p>
                    <p className="text-xs text-amber-600">세션 만료됨</p>
                  </div>
                </div>
              </div>

              {/* Extension 사용 가능 시 재시도 옵션 */}
              {extensionAvailable && failedPublishItems.length > 0 && (
                <div className="p-4 bg-blue-50 rounded-xl mb-4 border border-blue-100">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                      <RefreshCw size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">자동 복구 가능</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Band Session Helper에서 세션을 저장한 후 {failedPublishItems.length}개 상품을 자동으로 재시도합니다.
                      </p>
                      {retryMessage && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                          {isRetrying && <Loader2 size={12} className="animate-spin" />}
                          {retryMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!extensionAvailable && (
                <p className="text-sm text-gray-600 mb-6">
                  채널 설정 페이지에서 밴드에 다시 로그인해주세요.
                </p>
              )}

              {extensionAvailable && failedPublishItems.length === 0 && (
                <p className="text-sm text-gray-600 mb-6">
                  Band Session Helper로 세션을 저장한 후 다시 발행해주세요.
                </p>
              )}

              <div className="flex flex-col gap-2">
                {/* Extension 사용 가능 + 실패 항목이 있을 때만 재시도 버튼 표시 */}
                {extensionAvailable && failedPublishItems.length > 0 && (
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={handleRetryWithSessionSave}
                    loading={isRetrying}
                    disabled={isRetrying}
                  >
                    <RefreshCw size={16} className="mr-2" />
                    세션 저장 후 재시도 ({failedPublishItems.length}개)
                  </Button>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setShowSessionExpiredModal(false)
                      setFailedPublishItems([])
                      setRetryMessage('')
                    }}
                    disabled={isRetrying}
                  >
                    닫기
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      router.push(`/sourcing/channel/detail/${expiredChannelInfo.channelId}`)
                    }}
                    disabled={isRetrying}
                  >
                    <ExternalLink size={16} className="mr-2" />
                    채널 설정
                  </Button>
                </div>
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
                closeUnpublishModal()
              }
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* 결과 표시 (성공/경고/에러) */}
            {unpublishResult.status !== 'idle' ? (
              <>
                {/* 결과 헤더 */}
                <div className={`p-6 border-b ${
                  unpublishResult.status === 'success' ? 'bg-green-50 border-green-100' :
                  unpublishResult.status === 'warning' ? 'bg-yellow-50 border-yellow-100' :
                  'bg-red-50 border-red-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${
                      unpublishResult.status === 'success' ? 'bg-green-100' :
                      unpublishResult.status === 'warning' ? 'bg-yellow-100' :
                      'bg-red-100'
                    }`}>
                      {unpublishResult.status === 'success' ? (
                        <Check size={24} className="text-green-600" />
                      ) : unpublishResult.status === 'warning' ? (
                        <AlertTriangle size={24} className="text-yellow-600" />
                      ) : (
                        <X size={24} className="text-red-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{unpublishResult.message}</h3>
                      <p className="text-sm text-gray-600">
                        {unpublishTarget.productName} → {unpublishTarget.targetName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 결과 콘텐츠 */}
                <div className="p-6">
                  {unpublishResult.details && (
                    <div className={`p-4 rounded-xl mb-4 ${
                      unpublishResult.status === 'success' ? 'bg-green-50 text-green-700' :
                      unpublishResult.status === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      <p className="text-sm">{unpublishResult.details}</p>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={closeUnpublishModal}
                  >
                    닫기
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* 확인 헤더 */}
                <div className="bg-red-50 p-6 border-b border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-full">
                      <Trash2 size={24} className="text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">발행 취소</h3>
                      <p className="text-sm text-gray-600">
                        {unpublishTarget.targetType === 'channel'
                          ? '소매밴드에서 게시물을 삭제합니다'
                          : '쇼핑몰에서 상품을 제거합니다'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 확인 콘텐츠 */}
                <div className="p-6">
                  <div className="p-4 bg-gray-50 rounded-xl mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">상품</span>
                      <span className="font-medium text-gray-900 truncate max-w-[200px]">{unpublishTarget.productName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {unpublishTarget.targetType === 'channel' ? '소매밴드' : '쇼핑몰'}
                      </span>
                      <span className="font-medium text-gray-900">{unpublishTarget.targetName}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-6">
                    이 상품의 발행을 취소하시겠습니까?
                    <br />
                    {unpublishTarget.targetType === 'channel' ? (
                      <span className="text-red-500">
                        소매밴드에서 해당 게시물이 삭제됩니다.
                        <br />
                        주문 또는 문의가 있는 상품은 취소할 수 없습니다.
                      </span>
                    ) : (
                      <span className="text-red-500">
                        주문 또는 문의가 있는 상품은 취소할 수 없습니다.
                      </span>
                    )}
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={closeUnpublishModal}
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
              </>
            )}
          </div>
        </div>
      )}

      {/* 발행 진행 모달 */}
      {showPublishProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden max-h-[80vh] flex flex-col">
            {/* 헤더 */}
            {(() => {
              const successCount = publishProgressItems.filter((i) => i.status === 'success').length
              const failedCount = publishProgressItems.filter((i) => i.status === 'failed').length
              const allFailed = !isPublishing && failedCount > 0 && successCount === 0
              const hasFailed = !isPublishing && failedCount > 0

              return (
                <div className={`p-6 border-b ${
                  isPublishing
                    ? 'bg-blue-50 border-blue-100'
                    : allFailed
                    ? 'bg-red-50 border-red-100'
                    : hasFailed
                    ? 'bg-amber-50 border-amber-100'
                    : 'bg-green-50 border-green-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${
                      isPublishing
                        ? 'bg-blue-100'
                        : allFailed
                        ? 'bg-red-100'
                        : hasFailed
                        ? 'bg-amber-100'
                        : 'bg-green-100'
                    }`}>
                      {isPublishing ? (
                        <Loader2 size={24} className="text-blue-600 animate-spin" />
                      ) : allFailed ? (
                        <XCircle size={24} className="text-red-600" />
                      ) : hasFailed ? (
                        <AlertTriangle size={24} className="text-amber-600" />
                      ) : (
                        <CheckCircle size={24} className="text-green-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {isPublishing
                          ? '발행 진행 중...'
                          : allFailed
                          ? '발행 실패'
                          : hasFailed
                          ? '발행 일부 실패'
                          : '발행 완료'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {isPublishing
                          ? '페이지를 나가거나 새로고침하면 발행이 취소될 수 있습니다.'
                          : `${successCount}개 성공, ${failedCount}개 실패`}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* 경고 메시지 + 취소 버튼 (발행 중일 때만) */}
            {isPublishing && (
              <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertOctagon size={16} className="text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    발행이 완료될 때까지 이 창을 닫지 마세요.
                  </p>
                </div>
                <button
                  onClick={handleCancelPublish}
                  disabled={isCancelling}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      취소 중...
                    </>
                  ) : (
                    <>
                      <StopCircle size={14} />
                      발행 취소
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 진행 항목 목록 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {publishProgressItems.map((item, index) => (
                  <div
                    key={`${item.productId}-${item.targetId}-${item.targetType}`}
                    className={`p-3 rounded-lg border ${
                      item.status === 'publishing'
                        ? 'bg-blue-50 border-blue-200'
                        : item.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : item.status === 'failed'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* 상태 아이콘 */}
                      <div className="flex-shrink-0">
                        {item.status === 'publishing' ? (
                          <Loader2 size={18} className="text-blue-500 animate-spin" />
                        ) : item.status === 'success' ? (
                          <CheckCircle size={18} className="text-green-500" />
                        ) : item.status === 'failed' ? (
                          <XCircle size={18} className="text-red-500" />
                        ) : (
                          <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300" />
                        )}
                      </div>

                      {/* 상품/타겟 정보 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <span>→</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            item.targetType === 'shop' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {item.targetType === 'shop' ? 'Shop' : '밴드'}
                          </span>
                          <span className="truncate">{item.targetName}</span>
                        </p>
                      </div>

                      {/* 상태 텍스트 */}
                      <div className="flex-shrink-0 text-right">
                        <span className={`text-xs font-medium ${
                          item.status === 'publishing'
                            ? 'text-blue-600'
                            : item.status === 'success'
                            ? 'text-green-600'
                            : item.status === 'failed'
                            ? 'text-red-600'
                            : 'text-gray-400'
                        }`}>
                          {item.status === 'publishing'
                            ? (item.stageLabel || '발행 중...')
                            : item.status === 'success'
                            ? '완료'
                            : item.status === 'failed'
                            ? '실패'
                            : '대기'}
                        </span>
                        {/* 이미지 진행률 표시 */}
                        {item.status === 'publishing' && item.imageProgress && (
                          <div className="mt-1">
                            <div className="flex items-center gap-1 text-xs text-blue-500">
                              <span>{item.imageProgress.current}/{item.imageProgress.total}</span>
                              <span>이미지</span>
                            </div>
                            <div className="w-20 h-1 bg-blue-100 rounded-full overflow-hidden mt-0.5">
                              <div
                                className="h-full bg-blue-500 transition-all duration-200"
                                style={{ width: `${(item.imageProgress.current / item.imageProgress.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {/* 발행 방법 표시 */}
                        {item.status === 'success' && item.publishMethod && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.publishMethod === 'playwright' ? '이미지 포함' : '텍스트만'}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* 실패 사유 표시 (별도 줄) */}
                    {item.status === 'failed' && item.message && (
                      <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700">
                        <span className="font-medium">실패 사유:</span> {item.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 진행률 바 */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>진행률</span>
                <span>
                  {publishProgressItems.filter((i) => i.status === 'success' || i.status === 'failed').length} / {publishProgressItems.length}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                  style={{
                    width: `${(publishProgressItems.filter((i) => i.status === 'success' || i.status === 'failed').length / publishProgressItems.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* 푸터 (발행 완료 후에만 표시) */}
            {!isPublishing && (
              <div className="p-4 border-t border-gray-200">
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowPublishProgress(false)
                    setPublishProgressItems([])
                  }}
                >
                  닫기
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
