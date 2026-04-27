'use client'

import { useEffect, useMemo, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  ChevronDown,
} from 'lucide-react'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import { checkExtensionInstalled, saveSessionViaExtension } from '@/lib/band-extension'
import { CATEGORY_LIST } from '@/modules/category/category.keywords'

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

function PublishPageContent() {
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)

  const [shops, setShops] = useState<Shop[]>([])
  const [isLoadingShops, setIsLoadingShops] = useState(true)

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [isPublishing, setIsPublishing] = useState(false)
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)

  const [searchTerm, setSearchTerm] = useState('')

  // 도매밴드 필터
  const [selectedWholesaleChannel, setSelectedWholesaleChannel] = useState<number | null>(null)
  const [wholesaleChannels, setWholesaleChannels] = useState<WholesaleChannel[]>([])

  // 날짜 필터 (기본값: 오늘)
  const [daysWithin, setDaysWithin] = useState<number | null>(1)

  // 카테고리 필터 ('all' 또는 SEA/AGR/MEA/MKT/PRC/HLT/ETC)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // 페이징
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)

  // 한 페이지 진열 개수 (20/50/100)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)

  // 상품(행) 단위 선택 (기존 셀 단위 selectedCells와 별도)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [selectAllProducts, setSelectAllProducts] = useState(false)

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
    uploadProgress?: {
      fileIndex: string    // "1/10"
      totalPercent: string // "10%"
      currentPercent: string // "92%"
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadChannels = async () => {
    try {
      setIsLoadingChannels(true)
      const response = await fetch('/api/channel?kind=RETAIL&limit=100')
      const data = await response.json()
      if (data.success) {
        setChannels((data.data as Channel[]).filter((ch) => ch.isActive))
      } else {
        console.error('채널 조회 응답 실패:', data.error)
        toast.error('소매채널 목록을 불러오지 못했습니다.')
      }
    } catch (error) {
      console.error('채널 조회 실패:', error)
      toast.error('소매채널 목록을 불러오지 못했습니다.')
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
      if (daysWithin !== null) params.append('daysWithin', String(daysWithin))
      if (selectedCategory && selectedCategory !== 'all') params.append('categoryId', selectedCategory)

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
  }, [currentPage, pageSize, selectedWholesaleChannel, daysWithin, selectedCategory])

  // 페이지/필터 변경 시 상품 로���
  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // URL productIds 파라미터로 상품 사전 선택
  useEffect(() => {
    const productIdsParam = searchParams.get('productIds')
    if (productIdsParam && products.length > 0 && channels.length > 0) {
      const preselectedIds = productIdsParam.split(',').map(Number).filter(Boolean)
      if (preselectedIds.length > 0) {
        // 로드된 상품 중 preselectedIds에 해당하는 것의 모든 채널 셀을 선택
        const newCells = new Set<string>()
        for (const product of products) {
          if (preselectedIds.includes(product.id)) {
            for (const channel of channels) {
              newCells.add(`${product.id}-${channel.id}`)
            }
          }
        }
        if (newCells.size > 0) {
          setSelectedCells(newCells)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, channels])

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

    // '쇼핑몰'과 '소매밴드' 그룹은 항상 표시, '기타 채널'은 아이템이 있을 때만 표시
    return groups.filter((g) => g.platform === 'SHOP' || g.platform === 'BAND' || g.items.length > 0)
  }, [channels, shops])

  // 총 타겟 수 (채널 + Shop)
  const allTargets = useMemo(() => {
    const targets: { type: 'shop' | 'channel'; id: number; name: string }[] = []
    shops.forEach((shop) => targets.push({ type: 'shop', id: shop.id, name: shop.name }))
    channels.forEach((ch) => targets.push({ type: 'channel', id: ch.id, name: ch.name }))
    return targets
  }, [channels, shops])

  // 채널 발행 여부 확인
  const isPublishedToChannel = useCallback((productId: number, channelId: number) => {
    const product = products.find((p) => p.id === productId)
    return product?.publishedChannels?.some((pc) => pc.channelId === channelId)
  }, [products])

  // Shop 발행 여부 확인
  const isPublishedToShop = useCallback((productId: number, shopId: number) => {
    const product = products.find((p) => p.id === productId)
    return product?.publishedShops?.some((ps) => ps.shopId === shopId)
  }, [products])

  // 타겟에 발행되었는지 확인 (type으로 구분)
  const isPublished = useCallback((productId: number, targetType: 'shop' | 'channel', targetId: number) => {
    if (targetType === 'shop') {
      return isPublishedToShop(productId, targetId)
    }
    return isPublishedToChannel(productId, targetId)
  }, [isPublishedToShop, isPublishedToChannel])

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

      // 채널 발행 처리 (자동발행과 동일한 /api/publish/template/publish 사용)
      // SSE 스트리밍 대신 상품별 단순 POST 호출 — 자동발행에서 검증된 양식/이미지 레이아웃/쇼핑몰 링크 포함
      for (const [channelId, productIds] of Object.entries(channelToProducts)) {
        if (publishCancelledRef.current) {
          console.log('[발행 취소] 채널 발행 루프 중단')
          break
        }
        if (productIds.length === 0) continue

        for (const productId of productIds) {
          if (publishCancelledRef.current) break

          const itemIdx = progressItems.findIndex(
            (p) => p.productId === productId &&
                   p.targetId === Number(channelId) &&
                   p.targetType === 'channel'
          )

          // publishing 상태 표시
          if (itemIdx !== -1) {
            setPublishProgressItems((prev) => {
              const updated = [...prev]
              updated[itemIdx] = { ...updated[itemIdx], status: 'publishing' }
              return updated
            })
            setCurrentPublishIndex(itemIdx)
          }

          try {
            const abortController = new AbortController()
            abortControllerRef.current = abortController

            const res = await fetch('/api/publish/template/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId, channelId: Number(channelId) }),
              signal: abortController.signal,
            })
            const data = await res.json()

            if (data.success || data.publishId) {
              successfulCells.add(cellKey(productId, 'channel', Number(channelId)))
              totalSuccess++
              if (itemIdx !== -1) {
                setPublishProgressItems((prev) => {
                  const updated = [...prev]
                  updated[itemIdx] = { ...updated[itemIdx], status: 'success' }
                  return updated
                })
              }
            } else {
              totalFailed++
              const errMsg = data.error || data.message || '발행 실패'
              errorMessages.push(errMsg)
              if (itemIdx !== -1) {
                setPublishProgressItems((prev) => {
                  const updated = [...prev]
                  updated[itemIdx] = { ...updated[itemIdx], status: 'failed', message: errMsg }
                  return updated
                })
              }
            }
          } catch (err: any) {
            if (err?.name === 'AbortError' || publishCancelledRef.current) {
              console.log('[발행 취소] template/publish 요청 취소됨')
              break
            }
            totalFailed++
            const errMsg = err?.message || '네트워크 오류'
            errorMessages.push(errMsg)
            if (itemIdx !== -1) {
              setPublishProgressItems((prev) => {
                const updated = [...prev]
                updated[itemIdx] = { ...updated[itemIdx], status: 'failed', message: errMsg }
                return updated
              })
            }
          }
          processedIndex++
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

      // 자동발행과 동일한 /api/publish/template/publish 사용 (SSE는 본문 포맷이 깨지는 이슈)
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      let successCount = 0
      let failCount = 0

      for (const productId of productIds) {
        if (publishCancelledRef.current) break

        const itemIdx = failedPublishItems.findIndex((p) => p.productId === productId)
        if (itemIdx !== -1) {
          setPublishProgressItems((prev) => {
            const updated = [...prev]
            updated[itemIdx] = { ...updated[itemIdx], status: 'publishing' }
            return updated
          })
          setCurrentPublishIndex(itemIdx)
        }

        try {
          const res = await fetch('/api/publish/template/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ productId, channelId }),
            signal: abortController.signal,
          })
          const data = await res.json()

          if (data.success || data.publishId) {
            successCount++
            if (itemIdx !== -1) {
              setPublishProgressItems((prev) => {
                const updated = [...prev]
                updated[itemIdx] = { ...updated[itemIdx], status: 'success' }
                return updated
              })
            }
          } else {
            failCount++
            const errMsg = data.error || data.message || '발행 실패'
            if (itemIdx !== -1) {
              setPublishProgressItems((prev) => {
                const updated = [...prev]
                updated[itemIdx] = { ...updated[itemIdx], status: 'failed', message: errMsg }
                return updated
              })
            }
          }
        } catch (err: any) {
          if (err?.name === 'AbortError' || publishCancelledRef.current) break
          failCount++
          const errMsg = err?.message || '네트워크 오류'
          if (itemIdx !== -1) {
            setPublishProgressItems((prev) => {
              const updated = [...prev]
              updated[itemIdx] = { ...updated[itemIdx], status: 'failed', message: errMsg }
              return updated
            })
          }
        }
      }

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

      // 자동발행과 동일한 /api/publish/template/publish 사용 (SSE 경로는 본문 포맷 깨짐)
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      let successCount = 0
      let failCount = 0

      for (const productId of productIds) {
        if (publishCancelledRef.current) break

        const itemIdx = failedPublishItems.findIndex((p) => p.productId === productId)
        if (itemIdx !== -1) {
          setPublishProgressItems((prev) => {
            const updated = [...prev]
            updated[itemIdx] = { ...updated[itemIdx], status: 'publishing' }
            return updated
          })
          setCurrentPublishIndex(itemIdx)
        }

        try {
          const res = await fetch('/api/publish/template/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ productId, channelId }),
            signal: abortController.signal,
          })
          const data = await res.json()

          if (data.success || data.publishId) {
            successCount++
            if (itemIdx !== -1) {
              setPublishProgressItems((prev) => {
                const updated = [...prev]
                updated[itemIdx] = { ...updated[itemIdx], status: 'success' }
                return updated
              })
            }
          } else {
            failCount++
            const errMsg = data.error || data.message || '발행 실패'
            if (itemIdx !== -1) {
              setPublishProgressItems((prev) => {
                const updated = [...prev]
                updated[itemIdx] = { ...updated[itemIdx], status: 'failed', message: errMsg }
                return updated
              })
            }
          }
        } catch (err: any) {
          if (err?.name === 'AbortError' || publishCancelledRef.current) break
          failCount++
          const errMsg = err?.message || '네트워크 오류'
          if (itemIdx !== -1) {
            setPublishProgressItems((prev) => {
              const updated = [...prev]
              updated[itemIdx] = { ...updated[itemIdx], status: 'failed', message: errMsg }
              return updated
            })
          }
        }
      }

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

  /**
   * 선택한 상품을 재발행 (새 발행으로 등록 → 최상단 노출)
   * 1. 기존 ShopProduct soft-delete (DELETE /api/shop/publish?productId=xxx)
   * 2. 새 ShopProduct 생성 (POST /api/shop/publish) → publishedAt=now → 최상단
   */
  // 재발행 진행 상태
  const [republishProgress, setRepublishProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })
  const [republishingIds, setRepublishingIds] = useState<Set<number>>(new Set())

  // 재발행 대상 선택 모달
  const [republishModalOpen, setRepublishModalOpen] = useState(false)
  const [republishAvailableChannels, setRepublishAvailableChannels] = useState<{ id: number; name: string }[]>([])
  const [republishAvailableShops, setRepublishAvailableShops] = useState<{ id: number; name: string }[]>([])
  const [republishSelectedChannelIds, setRepublishSelectedChannelIds] = useState<Set<number>>(new Set())
  const [republishSelectedShopIds, setRepublishSelectedShopIds] = useState<Set<number>>(new Set())

  // 재발행 버튼 클릭 → 채널/쇼핑몰 목록 가져와 선택 모달 열기
  const handleRepublishSelected = async () => {
    if (selectedProductIds.length === 0) {
      toast.error('재발행할 상품을 선택해주세요.')
      return
    }
    try {
      const [channelRes, shopRes] = await Promise.all([
        fetch('/api/channel?kind=RETAIL&limit=100', { credentials: 'include' }),
        fetch('/api/shop?isActive=true&limit=100', { credentials: 'include' }),
      ])
      const channelData = await channelRes.json()
      const shopData = await shopRes.json()
      const retailChannels: { id: number; name: string }[] = channelData.success ? channelData.data : []
      const allShops: { id: number; name: string; isActive: boolean }[] = shopData.success ? (shopData.data || []) : []
      const activeShops = allShops.filter((s) => s.isActive !== false)

      if (retailChannels.length === 0 && activeShops.length === 0) {
        toast.error('등록된 소매밴드 또는 쇼핑몰이 없습니다.')
        return
      }

      setRepublishAvailableChannels(retailChannels)
      setRepublishAvailableShops(activeShops.map((s) => ({ id: s.id, name: s.name })))
      // 기본값: 전부 미선택 — 사용자가 명시적으로 1개 이상 골라야 발행되도록.
      // (이전엔 confirm() 후 무조건 모든 채널·쇼핑몰에 발행 → 의도치 않은 일괄 발행 사고).
      setRepublishSelectedChannelIds(new Set())
      setRepublishSelectedShopIds(new Set())
      setRepublishModalOpen(true)
    } catch (err: any) {
      toast.error(`채널/쇼핑몰 조회 실패: ${err?.message || '알 수 없음'}`)
    }
  }

  // 모달에서 "재발행 시작" 클릭 → 선택된 채널/쇼핑몰만 발행
  const confirmRepublish = async () => {
    setRepublishModalOpen(false)

    const targetIds = [...selectedProductIds]
    const retailChannels = republishAvailableChannels.filter((c) =>
      republishSelectedChannelIds.has(c.id)
    )
    const activeShops = republishAvailableShops.filter((s) =>
      republishSelectedShopIds.has(s.id)
    )

    if (retailChannels.length === 0 && activeShops.length === 0) {
      toast.error('발행할 대상(소매밴드 또는 쇼핑몰)을 1개 이상 선택해주세요.')
      return
    }

    setIsPublishing(true)
    setRepublishingIds(new Set(targetIds))
    setRepublishProgress({ current: 0, total: targetIds.length, success: 0, failed: 0 })
    setSelectedProductIds([])
    setSelectAllProducts(false)

    let successCount = 0
    let failCount = 0

    try {
      // 자동발행과 동일한 순서로 발행: 각 상품마다 밴드 먼저 → 쇼핑몰 나중
      for (let i = 0; i < targetIds.length; i++) {
        const productId = targetIds[i]
        setRepublishProgress(prev => ({ ...prev, current: i + 1 }))
        let productOk = true

        // 2-1) 소매밴드 발행 (Playwright 템플릿)
        for (const channel of retailChannels) {
          try {
            const res = await fetch('/api/publish/template/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ productId, channelId: channel.id }),
            })
            const data = await res.json()
            if (!(data.success || data.publishId)) {
              console.warn(`재발행 - 밴드 발행 실패 (channelId=${channel.id}):`, data.message || data.error)
              productOk = false
            }
          } catch (e) {
            console.warn(`재발행 - 밴드 발행 오류 (channelId=${channel.id})`, e)
            productOk = false
          }
        }

        // 2-2) 쇼핑몰 발행 (Shop별 ShopProduct 생성/갱신)
        for (const shop of activeShops) {
          try {
            await fetch('/api/shop/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ productIds: [productId], shopId: shop.id }),
            })
          } catch (e) {
            console.warn(`재발행 - 쇼핑몰 발행 실패 (shopId=${shop.id})`, e)
          }
        }

        // 2-3) 성공 시 republishedAt 마킹 (가공상품 목록 "재발행완료" 표시용)
        if (productOk) {
          try {
            await fetch(`/api/product/${productId}/republish-mark`, {
              method: 'POST',
              credentials: 'include',
            })
          } catch (e) {
            console.warn(`재발행 - republish-mark 실패 (productId=${productId})`, e)
          }
          successCount++
        } else {
          failCount++
        }

        setRepublishProgress(prev => ({ ...prev, success: successCount, failed: failCount }))
        setRepublishingIds(prev => {
          const next = new Set(prev)
          next.delete(productId)
          return next
        })
      }
    } catch (err: any) {
      toast.error(`재발행 중 오류: ${err?.message || '알 수 없는 오류'}`)
    } finally {
      setIsPublishing(false)
      setRepublishingIds(new Set())
      setRepublishProgress({ current: 0, total: 0, success: 0, failed: 0 })

      if (successCount > 0) {
        toast.success(`${successCount}개 재발행 완료 (쇼핑몰 + 밴드)`)
      }
      if (failCount > 0) {
        toast.error(`${failCount}개 재발행 실패`)
      }
      loadProducts()
    }
  }

  /**
   * 선택한 상품의 발행 레코드를 삭제 (soft-delete)
   * DELETE /api/shop/publish?productId=xxx
   */
  const handleDeleteSelected = async () => {
    if (selectedProductIds.length === 0) {
      toast.error('삭제할 상품을 선택해주세요.')
      return
    }
    if (!confirm(`선택한 ${selectedProductIds.length}개 상품을 삭제하시겠습니까?\n\n• 쇼핑몰 발행이 취소됩니다\n• 소매밴드 게시물이 삭제됩니다\n• 상품 목록에서 제거됩니다`)) {
      return
    }

    let successCount = 0
    let failCount = 0
    let bandErrors: string[] = []

    for (const productId of selectedProductIds) {
      try {
        const res = await fetch(`/api/shop/publish?productId=${productId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        const data = await res.json()
        if (res.ok && data.success) {
          successCount++
          if (data.bandDeleteErrors?.length > 0) {
            bandErrors.push(...data.bandDeleteErrors)
          }
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    setSelectedProductIds([])
    setSelectAllProducts(false)

    if (successCount > 0) {
      if (bandErrors.length > 0) {
        toast.success(`${successCount}개 상품 삭제 완료 (밴드 게시물 ${bandErrors.length}건 삭제 실패)`)
      } else {
        toast.success(`${successCount}개 상품이 삭제되었습니다.`)
      }
      loadProducts()
    }
    if (failCount > 0) {
      toast.error(`${failCount}개 삭제에 실패했습니다.`)
    }
  }

  const formatPrice = (price: number | null) => (!price ? '-' : `₩${price.toLocaleString()}`)

  const selectedUnpublishedCount = selectedCells.size

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">발행</h1>
          <p className="text-sm sm:text-base text-gray-600">
            상품을 선택하여 채널, 쇼핑몰에 발행합니다.
          </p>
        </div>

        {/* 툴바: 한페이지 진열개수 + 재발행 + 삭제 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* 한 페이지 진열 개수 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">상품보기</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {([20, 50, 100] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size)
                    setCurrentPage(1)
                  }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    pageSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {size}개
                </button>
              ))}
            </div>
          </div>

          {/* 선택 정보 */}
          {selectedProductIds.length > 0 && (
            <span className="text-sm text-blue-600 font-medium">
              {selectedProductIds.length}개 선택됨
            </span>
          )}

          {/* 재발행 버튼 + 진행률 */}
          <button
            onClick={handleRepublishSelected}
            disabled={selectedProductIds.length === 0 || isPublishing}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedProductIds.length > 0 && !isPublishing
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <RefreshCw size={15} className={isPublishing && republishProgress.total > 0 ? 'animate-spin' : ''} />
            재발행
          </button>
          {isPublishing && republishProgress.total > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((republishProgress.current / republishProgress.total) * 100)}%` }}
                />
              </div>
              <span className="text-blue-600 font-medium whitespace-nowrap">
                {republishProgress.current}/{republishProgress.total}
                {republishProgress.success > 0 && <span className="text-emerald-600 ml-1">({republishProgress.success}성공)</span>}
                {republishProgress.failed > 0 && <span className="text-red-500 ml-1">({republishProgress.failed}실패)</span>}
              </span>
            </div>
          )}

          {/* 삭제 버튼 */}
          <button
            onClick={handleDeleteSelected}
            disabled={selectedProductIds.length === 0 || isPublishing}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedProductIds.length > 0 && !isPublishing
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Trash2 size={15} />
            삭제
          </button>
        </div>

        {/* 컨트롤 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6">
          <div className="p-3 sm:p-4 border-b border-gray-200 space-y-3 sm:space-y-4">
            {/* 검색창 - 모바일에서 상단 */}
            <div className="flex items-center gap-2 sm:hidden">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  type="text"
                  placeholder="상품 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && loadProducts(true)}
                  className="pl-10 w-full min-h-[44px]"
                />
              </div>
              <button
                onClick={() => loadProducts(true)}
                disabled={isLoading}
                className="p-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px]"
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin text-gray-400' : 'text-gray-600'} />
              </button>
            </div>

            {/* 첫 번째 줄: 범례 + 검색 */}
            <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 items-start lg:items-center justify-between">
              {/* 왼쪽: 범례 */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs sm:text-sm text-gray-500 mr-1 sm:mr-2">범례:</span>
                <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium bg-green-100 text-green-700 flex items-center gap-1 sm:gap-1.5">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-green-500 flex items-center justify-center">
                    <Check size={8} className="sm:w-2.5 sm:h-2.5 text-white" />
                  </div>
                  발행됨
                </span>
                <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium bg-gray-100 text-gray-700 flex items-center gap-1 sm:gap-1.5">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-gray-300" />
                  미발행
                </span>
                <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium bg-amber-100 text-amber-700 flex items-center gap-1 sm:gap-1.5">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-amber-200 border border-dashed border-amber-400" />
                  <span className="hidden sm:inline">가격미설정</span>
                  <span className="sm:hidden">미설정</span>
                </span>
                <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium bg-purple-100 text-purple-700 flex items-center gap-1 sm:gap-1.5">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-purple-500" />
                  선택됨
                </span>
              </div>

              {/* 오른쪽: 검색 - 데스크톱 */}
              <div className="hidden sm:flex items-center gap-2">
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

            {/* 두 번째 줄: 날짜 필터 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-gray-500 flex items-center gap-1">
                <Clock size={14} />
                등록일:
              </span>
              {[
                { label: '오늘', value: 1 },
                { label: '3일', value: 3 },
                { label: '7일', value: 7 },
                { label: '30일', value: 30 },
                { label: '전체', value: null },
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => {
                    setDaysWithin(option.value)
                    setCurrentPage(1)
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[36px] sm:min-h-[32px] ${
                    daysWithin === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* 카테고리 필터 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-gray-500">카테고리:</span>
              <button
                onClick={() => {
                  setSelectedCategory('all')
                  setCurrentPage(1)
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[36px] sm:min-h-[32px] ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              {CATEGORY_LIST.map((cat) => (
                <button
                  key={cat.code}
                  onClick={() => {
                    setSelectedCategory(cat.code)
                    setCurrentPage(1)
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[36px] sm:min-h-[32px] ${
                    selectedCategory === cat.code
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={cat.name}
                >
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>

            {/* 세 번째 줄: 도매밴드 필터 */}
            {wholesaleChannels.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm text-gray-500">도매밴드:</span>
                <button
                  onClick={() => {
                    setSelectedWholesaleChannel(null)
                    setCurrentPage(1)
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[36px] sm:min-h-[32px] ${
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
                    className={`px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[36px] sm:min-h-[32px] ${
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

          {/* 목록 */}
          {isLoading || isLoadingChannels || isLoadingShops ? (
            <div className="p-12">
              <Loading />
            </div>
          ) : (
            <>
            {/* 모바일: 카드 뷰 */}
            <div className="lg:hidden p-3 space-y-2">
              {products.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Package size={48} className="mx-auto mb-4 text-gray-300" />
                  상품이 없습니다.
                </div>
              ) : (
                <>
                {/* 전체 선택 헤더 */}
                <div className="flex items-center gap-2 px-1 pb-1">
                  <input
                    type="checkbox"
                    checked={selectAllProducts && products.length > 0}
                    onChange={() => {
                      if (selectAllProducts) {
                        setSelectedProductIds([])
                        setSelectAllProducts(false)
                      } else {
                        setSelectedProductIds(products.map(p => p.id))
                        setSelectAllProducts(true)
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">전체 선택</span>
                </div>
                {products.map((product) => {
                  const priceSet = hasPrice(product.id)
                  const isExpanded = expandedProductId === product.id
                  // 발행 상태 계산
                  let shopPublished = 0
                  let channelPublished = 0
                  let shopSelected = 0
                  let channelSelected = 0

                  groupedTargets.forEach(group => {
                    group.items.forEach(item => {
                      const published = isPublished(product.id, group.type, item.id)
                      const selected = selectedCells.has(cellKey(product.id, group.type, item.id))
                      if (group.type === 'shop') {
                        if (published) shopPublished++
                        if (selected) shopSelected++
                      } else {
                        if (published) channelPublished++
                        if (selected) channelSelected++
                      }
                    })
                  })

                  const totalShops = groupedTargets.find(g => g.type === 'shop')?.items.length || 0
                  const totalChannels = groupedTargets.find(g => g.type === 'channel')?.items.length || 0
                  const hasSelection = shopSelected > 0 || channelSelected > 0

                  return (
                    <div
                      key={product.id}
                      className={`bg-white border rounded-xl overflow-hidden transition-all ${
                        selectedProductIds.includes(product.id)
                          ? 'border-blue-300 ring-1 ring-blue-200'
                          : hasSelection ? 'border-purple-300 ring-1 ring-purple-200' : 'border-gray-200'
                      }`}
                    >
                      {/* 상품 헤더 - 탭하면 펼침 */}
                      <div className="p-3 flex items-center gap-3">
                        {/* 체크박스 */}
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(product.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            setSelectedProductIds(prev =>
                              prev.includes(product.id)
                                ? prev.filter(id => id !== product.id)
                                : [...prev, product.id]
                            )
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer flex-shrink-0"
                        />
                        <button
                        onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                        className="flex-1 flex items-center gap-3 text-left active:bg-gray-50"
                      >
                        {/* 썸네일 */}
                        {product.thumbnailUrl ? (
                          <img
                            src={product.thumbnailUrl}
                            alt=""
                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package size={20} className="text-gray-400" />
                          </div>
                        )}

                        {/* 상품 정보 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">
                            {product.name}
                          </p>

                          {/* 상태 뱃지 */}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {!priceSet && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium">
                                <AlertTriangle size={10} />
                                가격미설정
                              </span>
                            )}
                            {totalShops > 0 && (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                shopPublished === totalShops
                                  ? 'bg-blue-500 text-white'
                                  : shopPublished > 0
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                <ShoppingCart size={10} />
                                {shopPublished}/{totalShops}
                              </span>
                            )}
                            {totalChannels > 0 && (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                channelPublished === totalChannels
                                  ? 'bg-green-500 text-white'
                                  : channelPublished > 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                <BandIcon size={10} />
                                {channelPublished}/{totalChannels}
                              </span>
                            )}
                            {hasSelection && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500 text-white text-[10px] font-medium">
                                <Check size={10} />
                                {shopSelected + channelSelected}개 선택
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 펼침 아이콘 */}
                        <ChevronDown
                          size={20}
                          className={`text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                      </div>

                      {/* 펼침 영역 - 발행 대상 선택 */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-3">
                          {groupedTargets.map((group) => (
                            <div key={group.platform}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1 rounded ${group.badgeColor} text-white`}>
                                    {group.icon}
                                  </div>
                                  <span className={`text-xs font-semibold ${group.headerTextColor}`}>
                                    {group.label}
                                  </span>
                                </div>
                                {/* 전체선택 버튼 */}
                                {group.items.length > 0 && (
                                <button
                                  onClick={() => {
                                    const allSelected = group.items.every(item =>
                                      selectedCells.has(cellKey(product.id, group.type, item.id))
                                    )
                                    group.items.forEach(item => {
                                      const key = cellKey(product.id, group.type, item.id)
                                      if (allSelected) {
                                        setSelectedCells(prev => {
                                          const next = new Set(prev)
                                          next.delete(key)
                                          return next
                                        })
                                      } else if (!isPublished(product.id, group.type, item.id)) {
                                        setSelectedCells(prev => new Set(prev).add(key))
                                      }
                                    })
                                  }}
                                  className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                                >
                                  {group.items.every(item => selectedCells.has(cellKey(product.id, group.type, item.id)))
                                    ? '전체해제'
                                    : '전체선택'}
                                </button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                {group.items.length > 0 ? (
                                  group.items.map((item) => {
                                    const published = isPublished(product.id, group.type, item.id)
                                    const selected = selectedCells.has(cellKey(product.id, group.type, item.id))
                                    return (
                                      <button
                                        key={`${group.type}-${item.id}`}
                                        onClick={() => handleCellClick(product.id, group.type, item.id)}
                                        disabled={published}
                                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                                          selected
                                            ? 'bg-purple-500 text-white shadow-sm'
                                            : published
                                            ? 'bg-green-100 text-green-700 cursor-default'
                                            : !priceSet
                                            ? 'bg-amber-50 text-amber-700 border border-dashed border-amber-300'
                                            : 'bg-white text-gray-700 border border-gray-200 active:bg-gray-100'
                                        }`}
                                      >
                                        <span className="truncate">{item.name}</span>
                                        {published && <Check size={14} className="flex-shrink-0 ml-1" />}
                                        {selected && !published && <Check size={14} className="flex-shrink-0 ml-1" />}
                                      </button>
                                    )
                                  })
                                ) : (
                                  <p className="col-span-2 text-xs text-gray-400 py-2 text-center">
                                    등록된 {group.label}이 없습니다
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                </>
              )}
            </div>

            {/* 데스크톱: 매트릭스 테이블 */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  {/* 그룹 헤더 (쇼핑몰 / 소매밴드 구분) */}
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-100 border-b-2 border-r-2 border-gray-300 p-3 text-left min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectAllProducts && products.length > 0}
                          onChange={() => {
                            if (selectAllProducts) {
                              setSelectedProductIds([])
                              setSelectAllProducts(false)
                            } else {
                              setSelectedProductIds(products.map(p => p.id))
                              setSelectAllProducts(true)
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                        />
                        <span className="text-sm font-bold text-gray-700">상품</span>
                      </div>
                    </th>
                    {groupedTargets.map((group, groupIndex) => (
                      <th
                        key={group.platform}
                        colSpan={Math.max(group.items.length, 1)}
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
                      group.items.length > 0 ? (
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
                      ) : (
                        <th
                          key={`${group.type}-empty`}
                          className={`border-b border-gray-200 p-1.5 min-w-[80px] ${group.cellBgColor} ${
                            groupIndex < groupedTargets.length - 1 ? 'border-r-2 border-gray-300' : ''
                          }`}
                        >
                          <div className={`text-xs text-gray-400 mx-auto`}>
                            없음
                          </div>
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className={`hover:bg-gray-50/50 ${republishingIds.has(product.id) ? 'bg-blue-50/70 animate-pulse' : selectedProductIds.includes(product.id) ? 'bg-blue-50' : ''}`}>
                      <td
                        className="sticky left-0 z-10 bg-white border-b border-r-2 border-gray-300 p-2 min-w-[240px] max-w-[340px]"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(product.id)}
                            onChange={(e) => {
                              e.stopPropagation()
                              setSelectedProductIds(prev =>
                                prev.includes(product.id)
                                  ? prev.filter(id => id !== product.id)
                                  : [...prev, product.id]
                              )
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer flex-shrink-0"
                          />
                          <div
                            className="flex items-center gap-2 flex-1 cursor-pointer hover:opacity-80"
                            onClick={() => handleSelectRow(product.id)}
                            title="행 전체 선택/해제"
                          >
                          {product.thumbnailUrl ? (
                            <img src={product.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Package size={14} className="text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-gray-900 truncate" title={product.name}>{product.name}</span>
                              {republishingIds.has(product.id) && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700 whitespace-nowrap flex-shrink-0">
                                  <RefreshCw size={10} className="animate-spin" />
                                  재발행 중
                                </span>
                              )}
                            </div>
                          </div>
                          </div>
                        </div>
                      </td>
                      {groupedTargets.map((group, groupIndex) =>
                        group.items.length > 0 ? (
                        group.items.map((item, itemIndex) => {
                          const published = isPublished(product.id, group.type, item.id)
                          const selected = selectedCells.has(cellKey(product.id, group.type, item.id))
                          const priceSet = hasPrice(product.id)
                          const isLastInGroup = itemIndex === group.items.length - 1
                          const hasNextGroup = groupIndex < groupedTargets.length - 1
                          const isRepublishingRow = republishingIds.has(product.id)

                          return (
                            <td
                              key={`${group.type}-${item.id}`}
                              className={`border-b border-gray-200 p-1 text-center ${group.cellBgColor} ${
                                isLastInGroup && hasNextGroup ? 'border-r-2 border-gray-300' : ''
                              }`}
                            >
                              <button
                                onClick={() => handleCellClick(product.id, group.type, item.id)}
                                disabled={isRepublishingRow}
                                className={`w-8 h-8 rounded transition-all ${
                                  isRepublishingRow
                                    ? 'bg-gray-300 animate-pulse cursor-wait'
                                    : selected
                                    ? 'bg-purple-500 hover:bg-purple-600 cursor-pointer ring-2 ring-purple-300'
                                    : published
                                    ? (group.type === 'shop'
                                        ? 'bg-green-500 hover:bg-green-600 cursor-pointer'
                                        : 'bg-green-500 cursor-default')
                                    : !priceSet
                                    ? 'bg-amber-100 hover:bg-amber-200 cursor-pointer border-2 border-dashed border-amber-300'
                                    : 'bg-gray-200 hover:bg-gray-300 cursor-pointer'
                                }`}
                                title={
                                  isRepublishingRow
                                    ? '재발행 중…'
                                    : `${product.name} → ${item.name}: ${
                                        published
                                          ? (group.type === 'shop' ? '발행됨 (클릭하여 취소)' : '발행됨')
                                          : !priceSet ? '가격 미설정 (설정 필요)' : '미발행'
                                      }`
                                }
                              >
                                {!isRepublishingRow && published && <Check size={16} className="text-white mx-auto" />}
                                {!isRepublishingRow && !published && !priceSet && <AlertTriangle size={12} className="text-amber-500 mx-auto" />}
                              </button>
                            </td>
                          )
                        })
                        ) : (
                          <td
                            key={`${group.type}-empty-${product.id}`}
                            className={`border-b border-gray-200 p-1 text-center ${group.cellBgColor} ${
                              groupIndex < groupedTargets.length - 1 ? 'border-r-2 border-gray-300' : ''
                            }`}
                          >
                            <div className="w-8 h-8 rounded bg-gray-100 mx-auto" />
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

              {products.length === 0 && (
                <div className="hidden lg:flex p-12 text-center text-gray-500 flex-col items-center justify-center">
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

      {/* 재발행 대상 선택 모달 */}
      {republishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setRepublishModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
              <h3 className="text-lg font-bold text-gray-900">🔁 재발행 대상 선택</h3>
              <p className="text-xs text-gray-600 mt-1">
                선택한 <strong>{selectedProductIds.length}개</strong> 상품을 어디에 재발행할지 고르세요.
                밴드/쇼핑몰 각각 다중 선택 가능. 1개 이상 선택해야 발행됩니다.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* 소매밴드 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    🟦 소매밴드 ({republishSelectedChannelIds.size}/{republishAvailableChannels.length})
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setRepublishSelectedChannelIds(
                          new Set(republishAvailableChannels.map((c) => c.id))
                        )
                      }
                      className="text-xs px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700"
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepublishSelectedChannelIds(new Set())}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      선택 취소
                    </button>
                  </div>
                </div>
                {republishAvailableChannels.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2">등록된 소매밴드가 없습니다.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {republishAvailableChannels.map((ch) => {
                      const checked = republishSelectedChannelIds.has(ch.id)
                      return (
                        <label
                          key={ch.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                            checked
                              ? 'bg-blue-50 border-blue-400 text-blue-900'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setRepublishSelectedChannelIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(ch.id)) next.delete(ch.id)
                                else next.add(ch.id)
                                return next
                              })
                            }
                            className="w-4 h-4 rounded border-gray-300 text-blue-600"
                          />
                          <span className="truncate">{ch.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 쇼핑몰 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">
                    🛍️ 쇼핑몰 ({republishSelectedShopIds.size}/{republishAvailableShops.length})
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setRepublishSelectedShopIds(
                          new Set(republishAvailableShops.map((s) => s.id))
                        )
                      }
                      className="text-xs px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700"
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepublishSelectedShopIds(new Set())}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      선택 취소
                    </button>
                  </div>
                </div>
                {republishAvailableShops.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2">활성 쇼핑몰이 없습니다.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {republishAvailableShops.map((sh) => {
                      const checked = republishSelectedShopIds.has(sh.id)
                      return (
                        <label
                          key={sh.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                            checked
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setRepublishSelectedShopIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(sh.id)) next.delete(sh.id)
                                else next.add(sh.id)
                                return next
                              })
                            }
                            className="w-4 h-4 rounded border-gray-300 text-emerald-600"
                          />
                          <span className="truncate">{sh.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between gap-2 bg-gray-50">
              <span className="text-xs text-gray-600">
                예정: 밴드 {republishSelectedChannelIds.size}개 + 쇼핑몰 {republishSelectedShopIds.size}개
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRepublishModalOpen(false)}
                  className="px-4 py-2 rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmRepublish}
                  disabled={
                    republishSelectedChannelIds.size === 0 &&
                    republishSelectedShopIds.size === 0
                  }
                  className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                >
                  재발행 시작
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

                <div className="flex gap-2">
                  {/* 닫기: 상태 유지 (나중에 재시도 가능) */}
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setShowSessionExpiredModal(false)
                      // failedPublishItems와 retryMessage 유지 - 나중에 재시도 가능
                    }}
                    disabled={isRetrying}
                  >
                    닫기
                  </Button>
                  {/* 포기: 실패 항목 삭제 */}
                  {failedPublishItems.length > 0 && (
                    <Button
                      variant="secondary"
                      className="flex-1 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setShowSessionExpiredModal(false)
                        setFailedPublishItems([])
                        setRetryMessage('')
                      }}
                      disabled={isRetrying}
                    >
                      포기
                    </Button>
                  )}
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
                        {/* 업로드 진행률 표시 (📤 로그 정보) */}
                        {item.status === 'publishing' && item.uploadProgress && (
                          <div className="mt-1 text-xs text-blue-500">
                            <span>📤 {item.uploadProgress.fileIndex} ({item.uploadProgress.totalPercent})</span>
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

export default function PublishPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loading /></div>}>
      <PublishPageContent />
    </Suspense>
  )
}
