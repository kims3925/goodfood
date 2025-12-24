'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Image as ImageIcon,
  RefreshCw,
  Download,
  Send,
  Eye,
  Package,
  Search,
  ChevronDown,
  Check,
  X,
  Loader2
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

interface Product {
  id: number
  name: string
  description: string | null
  thumbnailUrl: string | null
  price: number | null
  shippingFee: number | null
  bundleMaxQty: number | null
  variants: Array<{
    id: number
    optionSummary: string | null
    price: number
  }>
  images: Array<{
    url: string
    sortOrder: number
  }>
  channel: {
    id: number
    name: string
  } | null
}

interface Channel {
  id: number
  name: string
  channelKey: string
}

// 템플릿 타입
type TemplateType = 'standard' | 'simple' | 'premium'

export default function PublishTestPage() {
  const toast = useToast()
  const router = useRouter()
  const previewRef = useRef<HTMLDivElement>(null)

  // 상품 선택
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  // 채널 선택
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)

  // 템플릿 설정
  const [templateType, setTemplateType] = useState<TemplateType>('standard')
  const [customTitle, setCustomTitle] = useState('')
  const [customIntro, setCustomIntro] = useState('안녕하세요, 밴드 회원님들!')
  const [showOrderLink, setShowOrderLink] = useState(true)

  // 이미지 생성
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // 발행
  const [isPublishing, setIsPublishing] = useState(false)

  // 상품 목록 로드
  useEffect(() => {
    loadProducts()
    loadChannels()
  }, [])

  const loadProducts = async (search?: string) => {
    try {
      setIsLoadingProducts(true)
      const params = new URLSearchParams({ limit: '50' })
      if (search) params.append('search', search)

      const response = await fetch(`/api/product?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data)
      }
    } catch (error) {
      console.error('상품 로드 실패:', error)
    } finally {
      setIsLoadingProducts(false)
    }
  }

  const loadChannels = async () => {
    try {
      setIsLoadingChannels(true)
      const response = await fetch('/api/channel?kind=RETAIL&limit=100')
      const data = await response.json()

      if (data.success) {
        setChannels(data.data.filter((ch: any) => ch.isActive))
      }
    } catch (error) {
      console.error('채널 로드 실패:', error)
    } finally {
      setIsLoadingChannels(false)
    }
  }

  const handleSearch = () => {
    loadProducts(searchTerm)
  }

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product)
    setShowProductDropdown(false)
    setCustomTitle(product.name)
    setGeneratedImageUrl(null)
  }

  // 이미지 생성
  const handleGenerateImage = async () => {
    if (!selectedProduct) {
      toast.error('상품을 선택해주세요.')
      return
    }

    try {
      setIsGenerating(true)

      const response = await fetch('/api/publish/template/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          templateType,
          customTitle: customTitle || selectedProduct.name,
          customIntro,
          showOrderLink,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '이미지 생성 실패')
      }

      const blob = await response.blob()
      const imageUrl = URL.createObjectURL(blob)
      setGeneratedImageUrl(imageUrl)

      toast.success('이미지가 생성되었습니다!')
    } catch (error: any) {
      console.error('이미지 생성 실패:', error)
      toast.error(error.message || '이미지 생성에 실패했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  // 이미지 다운로드
  const handleDownloadImage = () => {
    if (!generatedImageUrl) return

    const link = document.createElement('a')
    link.href = generatedImageUrl
    link.download = `template-${selectedProduct?.id || 'preview'}.png`
    link.click()
  }

  // 발행 테스트
  const handlePublish = async () => {
    if (!selectedProduct) {
      toast.error('상품을 선택해주세요.')
      return
    }
    if (!selectedChannel) {
      toast.error('발행할 채널을 선택해주세요.')
      return
    }

    try {
      setIsPublishing(true)

      const response = await fetch('/api/publish/template/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          channelId: selectedChannel.id,
          templateType,
          customTitle: customTitle || selectedProduct.name,
          customIntro,
          showOrderLink,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('발행이 완료되었습니다!')
      } else {
        throw new Error(data.error || '발행 실패')
      }
    } catch (error: any) {
      console.error('발행 실패:', error)
      toast.error(error.message || '발행에 실패했습니다.')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">이미지 템플릿 발행 테스트</h1>
          <p className="text-gray-600">
            상품 정보를 이미지 템플릿으로 변환하여 밴드에 발행합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 왼쪽: 설정 패널 */}
          <div className="space-y-6">
            {/* 상품 선택 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package size={20} />
                상품 선택
              </h2>

              <div className="relative">
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type="text"
                      placeholder="상품 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      onFocus={() => setShowProductDropdown(true)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="secondary" onClick={handleSearch}>
                    검색
                  </Button>
                </div>

                {/* 선택된 상품 표시 */}
                {selectedProduct && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    {selectedProduct.thumbnailUrl ? (
                      <img src={selectedProduct.thumbnailUrl} alt="" className="w-12 h-12 rounded object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
                        <Package size={20} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{selectedProduct.name}</p>
                      <p className="text-sm text-gray-500">
                        {selectedProduct.price?.toLocaleString()}원
                        {selectedProduct.variants.length > 1 && ` (${selectedProduct.variants.length}개 옵션)`}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedProduct(null)
                        setGeneratedImageUrl(null)
                      }}
                      className="p-1 hover:bg-blue-100 rounded"
                    >
                      <X size={18} className="text-gray-500" />
                    </button>
                  </div>
                )}

                {/* 상품 드롭다운 */}
                {showProductDropdown && !selectedProduct && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
                    {isLoadingProducts ? (
                      <div className="p-4 text-center text-gray-500">
                        <Loader2 className="animate-spin mx-auto mb-2" size={20} />
                        로딩 중...
                      </div>
                    ) : products.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        상품이 없습니다.
                      </div>
                    ) : (
                      products.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleSelectProduct(product)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                        >
                          {product.thumbnailUrl ? (
                            <img src={product.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                              <Package size={16} className="text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                            <p className="text-xs text-gray-500">
                              {product.price?.toLocaleString()}원
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 템플릿 설정 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ImageIcon size={20} />
                템플릿 설정
              </h2>

              {/* 템플릿 타입 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">템플릿 스타일</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'standard', label: '기본형' },
                    { value: 'simple', label: '심플' },
                    { value: 'premium', label: '프리미엄' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setTemplateType(type.value as TemplateType)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        templateType === type.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 커스텀 타이틀 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">타이틀</label>
                <Input
                  type="text"
                  placeholder="커스텀 타이틀 (비워두면 상품명 사용)"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </div>

              {/* 인트로 문구 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">인트로 문구</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="인사말 입력..."
                  value={customIntro}
                  onChange={(e) => setCustomIntro(e.target.value)}
                />
              </div>

              {/* 주문 링크 표시 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showOrderLink"
                  checked={showOrderLink}
                  onChange={(e) => setShowOrderLink(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="showOrderLink" className="text-sm text-gray-700">
                  주문 링크 표시
                </label>
              </div>
            </div>

            {/* 채널 선택 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">발행 채널</h2>

              <select
                value={selectedChannel?.id || ''}
                onChange={(e) => {
                  const channel = channels.find((c) => c.id === Number(e.target.value))
                  setSelectedChannel(channel || null)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">채널 선택...</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-3">
              <Button
                onClick={handleGenerateImage}
                loading={isGenerating}
                disabled={!selectedProduct}
                className="flex-1"
                variant="secondary"
              >
                <Eye size={18} className="mr-2" />
                미리보기 생성
              </Button>

              <Button
                onClick={handlePublish}
                loading={isPublishing}
                disabled={!selectedProduct || !selectedChannel}
                className="flex-1"
              >
                <Send size={18} className="mr-2" />
                발행하기
              </Button>
            </div>
          </div>

          {/* 오른쪽: 미리보기 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">미리보기</h2>
              {generatedImageUrl && (
                <Button variant="secondary" size="sm" onClick={handleDownloadImage}>
                  <Download size={16} className="mr-1" />
                  다운로드
                </Button>
              )}
            </div>

            <div
              ref={previewRef}
              className="bg-gray-100 rounded-lg overflow-hidden"
              style={{ minHeight: '400px' }}
            >
              {generatedImageUrl ? (
                <img
                  src={generatedImageUrl}
                  alt="Generated Template"
                  className="w-full h-auto"
                />
              ) : selectedProduct ? (
                /* 실시간 HTML 미리보기 */
                <TemplatePreview
                  product={selectedProduct}
                  templateType={templateType}
                  customTitle={customTitle || selectedProduct.name}
                  customIntro={customIntro}
                  showOrderLink={showOrderLink}
                />
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                    <p>상품을 선택하면 미리보기가 표시됩니다.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 실시간 HTML 미리보기 컴포넌트
function TemplatePreview({
  product,
  templateType,
  customTitle,
  customIntro,
  showOrderLink,
}: {
  product: Product
  templateType: TemplateType
  customTitle: string
  customIntro: string
  showOrderLink: boolean
}) {
  const formatPrice = (price: number) => price.toLocaleString() + '원'

  return (
    <div
      className="bg-white p-6 font-['Pretendard',sans-serif]"
      style={{ width: '500px', margin: '0 auto' }}
    >
      {/* 헤더 (타이틀) */}
      <div className="bg-[#C8E6C9] rounded-lg p-4 mb-4">
        <h1
          className="font-bold text-gray-800 leading-tight"
          style={{ fontSize: customTitle.length > 30 ? '24px' : '36px' }}
        >
          {customTitle}
        </h1>
      </div>

      {/* 인트로 */}
      {customIntro && (
        <p className="text-gray-700 mb-4 text-base leading-relaxed whitespace-pre-line">
          {customIntro}
        </p>
      )}

      {/* 상품 정보 섹션 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        {/* 가격 정보 */}
        {product.variants && product.variants.length > 0 && (
          <div className="mb-3">
            <h3 className="font-bold text-gray-800 mb-2">💰 판매가</h3>
            <div className="space-y-1">
              {product.variants.slice(0, 5).map((variant, idx) => (
                <div key={variant.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{variant.optionSummary || '기본'}</span>
                  <span className="font-medium text-gray-900">{formatPrice(variant.price)}</span>
                </div>
              ))}
              {product.variants.length > 5 && (
                <p className="text-xs text-gray-500">외 {product.variants.length - 5}개 옵션</p>
              )}
            </div>
          </div>
        )}

        {/* 배송 정보 */}
        {(product.shippingFee || product.bundleMaxQty) && (
          <div className="border-t border-gray-200 pt-3">
            <h3 className="font-bold text-gray-800 mb-2">🚚 배송정보</h3>
            <div className="text-sm text-gray-600 space-y-1">
              {product.shippingFee && (
                <p>배송비: {formatPrice(product.shippingFee)}</p>
              )}
              {product.bundleMaxQty && product.bundleMaxQty > 1 && (
                <p>합배송: {product.bundleMaxQty}개까지 묶음배송</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 상품 설명 */}
      {product.description && (
        <div className="mb-4">
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
            {product.description.slice(0, 300)}
            {product.description.length > 300 && '...'}
          </p>
        </div>
      )}

      {/* 상품 이미지 미리보기 */}
      {product.images && product.images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {product.images.slice(0, 4).map((img, idx) => (
            <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-200">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* 주문 링크 */}
      {showOrderLink && (
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-blue-600 font-medium text-sm">
            🛒 주문하기 👉 [쇼핑몰 링크]
          </p>
        </div>
      )}
    </div>
  )
}
