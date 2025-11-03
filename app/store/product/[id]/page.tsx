'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Heart, Share2, ShoppingCart, Minus, Plus, Star, ChevronRight, Package, Truck, Shield } from 'lucide-react'

export default function ProductDetailPage() {
  const params = useParams()
  const [product, setProduct] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [activeTab, setActiveTab] = useState('detail')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadProduct()
  }, [params.id])

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      // 실제 API 호출
      const response = await fetch(`/api/shop/products/${params.id}`)
      const data = await response.json()
      
      if (data.success) {
        setProduct(data.product)
      } else {
        // 목업 데이터
        setProduct(getMockProduct())
      }
    } catch (error) {
      console.error('Failed to load product:', error)
      setProduct(getMockProduct())
    } finally {
      setIsLoading(false)
    }
  }

  const getMockProduct = () => ({
    id: params.id,
    title: '[500g 2,900원] 택배비보다 싼!! 가마솥 사골 도가니탕 2종',
    description: '진한 사골 육수와 쫄깃한 도가니가 들어있는 프리미엄 도가니탕입니다. 간편하게 데워먹기만 하면 되는 간편 조리 제품입니다.',
    originalPrice: 4900,
    salePrice: 2900,
    discount: 41,
    images: [
      'https://via.placeholder.com/600x600/FF6B6B/FFFFFF?text=도가니탕1',
      'https://via.placeholder.com/600x600/4ECDC4/FFFFFF?text=도가니탕2',
      'https://via.placeholder.com/600x600/F7B731/FFFFFF?text=도가니탕3',
    ],
    category: '육류',
    stock: 234,
    rating: 4.8,
    reviews: 234,
    shippingFee: 3000,
    freeShippingAmount: 30000,
    options: [
      { name: '사골도가니탕 500g', price: 2900 },
      { name: '사골도가니탕 1kg', price: 5400 },
      { name: '사골도가니탕 2kg', price: 9900 },
    ],
    detailImages: [
      'https://via.placeholder.com/800x1200/FF6B6B/FFFFFF?text=상품상세1',
      'https://via.placeholder.com/800x1200/4ECDC4/FFFFFF?text=상품상세2',
      'https://via.placeholder.com/800x1200/F7B731/FFFFFF?text=상품상세3',
    ],
  })

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
    try {
      // 세션 ID 생성 (실제로는 세션 관리 라이브러리 사용)
      let sessionId = localStorage.getItem('sessionId')
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2)
        localStorage.setItem('sessionId', sessionId)
      }

      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          productId: product.id,
          quantity
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(`${product.title}\n수량: ${quantity}개\n장바구니에 추가되었습니다.`)
      } else {
        alert(`장바구니 추가 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('장바구니 추가 오류:', error)
      alert('장바구니 추가 중 오류가 발생했습니다.')
    }
  }

  const handleBuyNow = () => {
    const checkoutUrl = `/store/checkout?productId=${product.id}&quantity=${quantity}`
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
            <button className="p-1">
              <Heart className="h-5 w-5" />
            </button>
            <button onClick={handleShare} className="p-1">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-white rounded-lg overflow-hidden">
              <img 
                src={product.images[selectedImage]} 
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {product.images.map((image: string, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 ${
                    selectedImage === index ? 'border-blue-600' : 'border-gray-200'
                  }`}
                >
                  <img src={image} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-4">
            {/* Category & Title */}
            <div>
              <p className="text-sm text-gray-500 mb-2">{product.category}</p>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">{product.title}</h1>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`h-5 w-5 ${i < Math.floor(product.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600">{product.rating} ({product.reviews}개 리뷰)</span>
            </div>

            {/* Price */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold text-red-500">{product.discount}%</span>
                <p className="text-lg text-gray-500 line-through">{formatPrice(product.originalPrice)}원</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatPrice(product.salePrice)}원</p>
            </div>

            {/* Shipping Info */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-700">배송비: {formatPrice(product.shippingInfo?.defaultShippingFee || 3000)}원</span>
              </div>
              <p className="text-xs text-gray-500 pl-6">
                {formatPrice(product.shippingInfo?.freeShippingAmount || 30000)}원 이상 구매시 무료배송
              </p>
            </div>

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
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-gray-300 rounded-lg">
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
                <span className="text-sm text-gray-500">재고: {product.stock}개</span>
              </div>
            </div>

            {/* Total Price */}
            <div className="flex items-center justify-between py-4 border-t">
              <span className="text-sm text-gray-600">총 상품금액</span>
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(product.salePrice * quantity)}원
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button className="flex-1 border border-gray-300 rounded-lg py-3 hover:bg-gray-50">
                <Heart className="h-5 w-5 mx-auto" />
              </button>
              <button 
                onClick={handleAddToCart}
                className="flex-1 bg-gray-800 text-white rounded-lg py-3 hover:bg-gray-900 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-5 w-5" />
                장바구니
              </button>
              <button 
                onClick={handleBuyNow}
                className="flex-1 bg-blue-600 text-white rounded-lg py-3 hover:bg-blue-700"
              >
                바로구매
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <Package className="h-6 w-6 mx-auto text-gray-600 mb-1" />
                <p className="text-xs text-gray-600">정품보장</p>
              </div>
              <div className="text-center">
                <Truck className="h-6 w-6 mx-auto text-gray-600 mb-1" />
                <p className="text-xs text-gray-600">당일발송</p>
              </div>
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto text-gray-600 mb-1" />
                <p className="text-xs text-gray-600">안전거래</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 bg-white rounded-lg">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('detail')}
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === 'detail' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500'
              }`}
            >
              상품상세
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === 'reviews' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500'
              }`}
            >
              리뷰 ({product.reviews})
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === 'info' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500'
              }`}
            >
              배송/교환/환불
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

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-900">{product.rating}</p>
                      <div className="flex mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-4 w-4 ${i < Math.floor(product.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">총 {product.reviews}개의 리뷰</p>
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <p className="text-center text-gray-500">아직 작성된 리뷰가 없습니다.</p>
                </div>
              </div>
            )}

            {activeTab === 'info' && (
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h3 className="font-medium mb-2">배송 안내</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>• 배송비: {formatPrice(product.shippingFee)}원 ({formatPrice(product.freeShippingAmount)}원 이상 무료)</li>
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 md:hidden z-40">
        <div className="flex gap-2">
          <button className="p-3 border border-gray-300 rounded-lg">
            <Heart className="h-5 w-5" />
          </button>
          <button 
            onClick={handleAddToCart}
            className="flex-1 bg-gray-800 text-white rounded-lg py-3 text-sm font-medium"
          >
            장바구니
          </button>
          <button 
            onClick={handleBuyNow}
            className="flex-1 bg-blue-600 text-white rounded-lg py-3 text-sm font-medium"
          >
            바로구매
          </button>
        </div>
      </div>
    </div>
  )
}
