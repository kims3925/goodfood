'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, Heart, Share2, Minus, Plus } from 'lucide-react'
import { useCartNotification } from '@/contexts/CartNotificationContext'

export default function ProductDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { showNotification } = useCartNotification()
  const bandId = searchParams.get('bandId')
  const [product, setProduct] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [activeTab, setActiveTab] = useState('detail')
  const [isLoading, setIsLoading] = useState(true)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)

  useEffect(() => {
    loadProduct()
  }, [params.id, bandId])

  useEffect(() => {
    if (session && product) {
      checkWishlistStatus()
    }
  }, [session, product])

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      const apiUrl = bandId
        ? `/api/shop/products/${params.id}?bandId=${bandId}`
        : `/api/shop/products/${params.id}`
      const response = await fetch(apiUrl)
      const data = await response.json()

      if (data.success) {
        setProduct(data.product)
      } else {
        console.error('Failed to load product:', data.error)
        setProduct(null)
      }
    } catch (error) {
      console.error('Failed to load product:', error)
      setProduct(null)
    } finally {
      setIsLoading(false)
    }
  }

  const checkWishlistStatus = async () => {
    if (!session) return

    try {
      const response = await fetch('/api/mypage/wishlist')
      const data = await response.json()

      if (data.success) {
        const isInWishlist = data.wishlists.some(
          (item: any) => item.product.id === parseInt(params.id as string)
        )
        setIsWishlisted(isInWishlist)
      }
    } catch (error) {
      console.error('Failed to check wishlist status:', error)
    }
  }

  const handleToggleWishlist = async () => {
    if (!session) {
      alert('로그인이 필요합니다')
      window.location.href = '/store/auth/login'
      return
    }

    if (wishlistLoading) return

    // productId를 숫자로 확실하게 변환
    const idParam = Array.isArray(params.id) ? params.id[0] : params.id
    const productIdNum = typeof idParam === 'string' ? parseInt(idParam) : idParam
    if (isNaN(productIdNum)) {
      alert('잘못된 상품 ID입니다')
      return
    }

    try {
      setWishlistLoading(true)

      if (isWishlisted) {
        // 찜 해제 - 먼저 찜 목록에서 해당 상품의 wishlist ID를 찾아야 함
        const response = await fetch('/api/mypage/wishlist')
        const data = await response.json()

        if (data.success) {
          const wishlistItem = data.wishlists.find(
            (item: any) => item.product.id === productIdNum
          )

          if (wishlistItem) {
            const deleteResponse = await fetch(`/api/mypage/wishlist/${wishlistItem.id}`, {
              method: 'DELETE',
            })
            const deleteData = await deleteResponse.json()

            if (deleteData.success) {
              setIsWishlisted(false)
              alert('찜 목록에서 삭제되었습니다')
            }
          }
        }
      } else {
        // 찜 추가
        console.log('[Wishlist] Adding product:', productIdNum)

        const response = await fetch('/api/mypage/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: productIdNum }),
        })

        const data = await response.json()
        console.log('[Wishlist] Add response:', data)

        if (data.success) {
          setIsWishlisted(true)
          alert('찜 목록에 추가되었습니다')
        } else {
          console.error('[Wishlist] Error:', data.error)
          // 상세한 에러 메시지 표시
          if (data.error && typeof data.error === 'string') {
            if (data.error.includes('Foreign key constraint') || data.error.includes('foreign key')) {
              alert('이 상품은 아직 찜할 수 없습니다.\n\n실제 등록된 상품 페이지(/store)에서 상품을 선택해주세요.')
            } else {
              alert(`찜하기 실패: ${data.error}`)
            }
          } else {
            alert('찜하기에 실패했습니다')
          }
        }
      }
    } catch (error) {
      console.error('[Wishlist] Failed to toggle wishlist:', error)
      alert('처리 중 오류가 발생했습니다')
    } finally {
      setWishlistLoading(false)
    }
  }

  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null || isNaN(price)) {
      return '0'
    }
    return price.toLocaleString()
  }

  const handleQuantityChange = (type: 'increase' | 'decrease') => {
    if (type === 'increase') {
      setQuantity(prev => prev + 1)
    } else {
      setQuantity(prev => Math.max(1, prev - 1))
    }
  }

  const handleAddToCart = async () => {
    if (!product?.productPublishId) {
      alert('상품 정보를 불러올 수 없습니다')
      return
    }

    try {
      // 세션 ID 생성 (실제로는 세션 관리 라이브러리 사용)
      let sessionId = localStorage.getItem('sessionId')
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2)
        localStorage.setItem('sessionId', sessionId)
      }

      const cartData = {
        sessionId,
        productPublishId: product.productPublishId,
        quantity
      }

      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cartData)
      })

      const data = await response.json()

      if (data.success) {
        // 알림 버블 표시
        showNotification({
          title: product.title,
          image: product.images?.[0] || '/images/placeholder.png',
          quantity: quantity,
          isExisting: data.isExisting // API에서 이미 담긴 상품인지 여부 반환
        })
      } else {
        alert(`장바구니 추가 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('장바구니 추가 오류:', error)
      alert('장바구니 추가 중 오류가 발생했습니다.')
    }
  }

  const handleBuyNow = () => {
    // 로그인 체크
    if (!session) {
      alert('로그인이 필요합니다')
      window.location.href = '/store/auth/login'
      return
    }

    // productPublishId를 체크아웃 페이지로 전달
    if (!product?.productPublishId) {
      alert('상품 정보를 불러올 수 없습니다')
      return
    }
    const checkoutUrl = `/store/checkout?productPublishId=${product.productPublishId}&quantity=${quantity}`
    window.location.href = checkoutUrl
  }

  const handleShare = () => {
    const shareText = `${product.title}\n${formatPrice(product.salePrice)}원\n${window.location.href}`
    navigator.clipboard.writeText(shareText)
    alert('상품 링크가 복사되었습니다!')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B]"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-gray-500 mb-4">상품을 찾을 수 없습니다.</p>
        <Link href="/store" className="text-blue-600 hover:underline">쇼핑몰 홈으로 돌아가기</Link>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 bg-white border-b md:hidden">
        <div className="flex items-center justify-between p-4">
          <Link href="/store" className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-sm font-medium flex-1 text-center line-clamp-1 px-2">
            {product.title}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleWishlist}
              disabled={wishlistLoading}
              className="p-1"
            >
              <Heart
                className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-700'}`}
              />
            </button>
            <button onClick={handleShare} className="p-1">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1050px] mx-auto px-4 py-4 md:py-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Product Images - 고정 너비 */}
          <div className="w-full lg:w-[430px] flex-shrink-0 space-y-3">
            <div className="w-full h-[430px] bg-white rounded-lg overflow-hidden border border-gray-200">
              <img
                src={product.images[selectedImage]}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
            {/* 썸네일 이미지 - 4열 고정 그리드 */}
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(0, 4).map((image: string, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 ${
                    selectedImage === index ? 'border-[#FF6B6B]' : 'border-gray-200'
                  }`}
                >
                  <img src={image} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex-1 space-y-5">
            {/* Category & Title */}
            <div>
              <p className="text-xs text-[#FF6B6B] font-medium mb-1">{product.category}</p>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{product.title}</h1>
              <p className="text-sm text-gray-500 mt-2">{product.description}</p>
            </div>


            {/* Price - 마켓컬리 스타일 */}
            <div className="border-t border-b py-5">
              <div className="flex items-baseline gap-2">
                {product.discount > 0 && (
                  <span className="text-2xl font-bold text-[#FF6B6B]">{product.discount}%</span>
                )}
                <span className="text-2xl font-bold text-gray-900">{formatPrice(product.salePrice)}</span>
                <span className="text-lg text-gray-900">원</span>
              </div>
              {product.discount > 0 && (
                <p className="text-sm text-gray-400 line-through mt-1">{formatPrice(product.originalPrice)}원</p>
              )}
            </div>

            {/* Shipping Info - 마켓컬리 스타일 리스트 */}
            <dl className="space-y-3 text-sm">
              <div className="flex">
                <dt className="w-20 text-gray-500 flex-shrink-0">배송</dt>
                <dd className="text-gray-900">
                  <p className="font-medium">
                    택배배송 {formatPrice(product.shippingInfo?.defaultShippingFee || 3000)}원
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatPrice(product.shippingInfo?.freeShippingAmount || 30000)}원 이상 무료배송
                  </p>
                  <p className="text-xs text-gray-500">
                    제주 추가 3,000원, 제주 외 도서지역 추가 5,000원
                  </p>
                </dd>
              </div>
              <div className="flex">
                <dt className="w-20 text-gray-500 flex-shrink-0">판매자</dt>
                <dd className="text-gray-900">{product.sellerName || product.bandName || '판매자'}</dd>
              </div>
              <div className="flex">
                <dt className="w-20 text-gray-500 flex-shrink-0">포장타입</dt>
                <dd className="text-gray-900">상온</dd>
              </div>
            </dl>

            {/* Options */}
            {product.options && product.options.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">옵션 선택</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  {product.options.map((option: any, index: number) => (
                    <option key={index} value={option.name}>
                      {option.name} - {formatPrice(option.price)}원
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">수량</label>
              <div className="flex items-center border border-gray-300 rounded-lg w-fit">
                <button
                  onClick={() => handleQuantityChange('decrease')}
                  className="p-2 hover:bg-gray-100"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={quantity}
                  readOnly
                  className="w-12 text-center border-x border-gray-300"
                />
                <button
                  onClick={() => handleQuantityChange('increase')}
                  className="p-2 hover:bg-gray-100"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Total Price - 마켓컬리 스타일 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">총 상품금액 :</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{formatPrice(product.salePrice * quantity)}</span>
                  <span className="text-sm text-gray-900">원</span>
                </div>
              </div>
            </div>

            {/* Action Buttons - 마켓컬리 스타일 */}
            <div className="flex gap-2">
              <button
                onClick={handleToggleWishlist}
                disabled={wishlistLoading}
                className="w-12 h-12 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center flex-shrink-0"
              >
                <Heart
                  className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-500'}`}
                />
              </button>
              <button
                onClick={handleAddToCart}
                className="flex-1 h-12 border-2 border-[#FF6B6B] text-[#FF6B6B] rounded-lg hover:bg-[#FFF5F5] font-medium"
              >
                장바구니 담기
              </button>
              {/* 비로그인 시 구매하기 버튼 숨김 (컬리 스타일) */}
              {session && (
                <button
                  onClick={handleBuyNow}
                  className="flex-1 h-12 bg-[#FF6B6B] text-white rounded-lg hover:bg-[#FF5252] font-medium"
                >
                  구매하기
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 bg-white rounded-lg">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('detail')}
              className={`flex-1 py-4 text-sm font-medium ${
                activeTab === 'detail'
                  ? 'text-[#FF6B6B] border-b-2 border-[#FF6B6B]'
                  : 'text-gray-500'
              }`}
            >
              상품설명
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-4 text-sm font-medium ${
                activeTab === 'info'
                  ? 'text-[#FF6B6B] border-b-2 border-[#FF6B6B]'
                  : 'text-gray-500'
              }`}
            >
              문의
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'detail' && (
              <div className="space-y-4">
                <p className="text-gray-700">{product.description}</p>
                {product.detailImages && product.detailImages.map((image: string, index: number) => (
                  <img key={index} src={image} alt="" className="w-full rounded-lg" />
                ))}
              </div>
            )}

            {activeTab === 'info' && (
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h3 className="font-medium mb-2">배송 안내</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• 배송비: {formatPrice(product.shippingInfo?.defaultShippingFee || 3000)}원 ({formatPrice(product.shippingInfo?.freeShippingAmount || 30000)}원 이상 무료)</li>
                    <li>• 배송기간: 결제 후 2-3일 이내</li>
                    <li>• 택배사: CJ대한통운</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium mb-2">교환/환불 안내</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• 상품 수령 후 7일 이내 교환/환불 가능</li>
                    <li>• 단순 변심의 경우 왕복 배송비 구매자 부담</li>
                    <li>• 상품 하자의 경우 무료 교환/환불</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Fixed Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 lg:hidden z-40">
        <div className="flex gap-2">
          <button
            onClick={handleToggleWishlist}
            disabled={wishlistLoading}
            className="w-12 h-12 border border-gray-300 rounded-lg flex items-center justify-center flex-shrink-0"
          >
            <Heart
              className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-500'}`}
            />
          </button>
          <button
            onClick={handleAddToCart}
            className="flex-1 h-12 border-2 border-[#FF6B6B] text-[#FF6B6B] rounded-lg text-sm font-medium hover:bg-[#FFF5F5]"
          >
            장바구니 담기
          </button>
          {/* 비로그인 시 구매하기 버튼 숨김 (컬리 스타일) */}
          {session && (
            <button
              onClick={handleBuyNow}
              className="flex-1 h-12 bg-[#FF6B6B] text-white rounded-lg text-sm font-medium hover:bg-[#FF5252]"
            >
              구매하기
            </button>
          )}
        </div>
      </div>

      {/* 모바일에서 하단 고정바 영역 확보 */}
      <div className="h-20 lg:hidden"></div>
    </div>
  )
}
