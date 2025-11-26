'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, Truck } from 'lucide-react'

interface ProductCardProps {
  id: number
  name: string
  price: number
  originalPrice?: number
  thumbnailUrl?: string
  isFreeShipping?: boolean
  shippingFee?: number
  badges?: Array<'sale' | 'new' | 'best'>
  isWishlisted?: boolean
  onWishlistClick?: (id: number) => void
}

export default function ProductCard({
  id,
  name,
  price,
  originalPrice,
  thumbnailUrl,
  isFreeShipping = false,
  shippingFee = 0,
  badges = [],
  isWishlisted = false,
  onWishlistClick,
}: ProductCardProps) {
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const discountRate = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0

  const formatPrice = (value: number) => {
    return value.toLocaleString('ko-KR')
  }

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onWishlistClick?.(id)
  }

  return (
    <Link href={`/product/${id}`}>
      <div
        className="product-card group cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image Container */}
        <div className="product-card-image">
          {thumbnailUrl && !imageError ? (
            <Image
              src={thumbnailUrl}
              alt={name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <span className="text-gray-400 text-sm">No Image</span>
            </div>
          )}

          {/* Badges */}
          {badges.length > 0 && (
            <div className="absolute top-3 left-3 flex flex-wrap gap-1">
              {badges.includes('sale') && (
                <span className="badge badge-sale">SALE</span>
              )}
              {badges.includes('new') && (
                <span className="badge badge-new">NEW</span>
              )}
              {badges.includes('best') && (
                <span className="badge badge-best">BEST</span>
              )}
            </div>
          )}

          {/* Wishlist Button */}
          <button
            className={`wishlist-btn ${
              isWishlisted ? 'text-sale' : 'text-gray-400'
            } ${isHovered ? 'opacity-100' : 'opacity-0 md:opacity-0'} transition-opacity`}
            onClick={handleWishlistClick}
          >
            <Heart
              className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`}
            />
          </button>
        </div>

        {/* Info Container */}
        <div className="product-card-info">
          {/* Product Name */}
          <h3 className="product-card-title">{name}</h3>

          {/* Price */}
          <div className="product-card-price">
            {discountRate > 0 && (
              <span className="discount-badge">{discountRate}%</span>
            )}
            <span className="price-sale">{formatPrice(price)}원</span>
          </div>

          {originalPrice && originalPrice > price && (
            <div className="mt-1">
              <span className="price-original">{formatPrice(originalPrice)}원</span>
            </div>
          )}

          {/* Shipping Info */}
          <div className="mt-2 flex items-center">
            {isFreeShipping ? (
              <span className="shipping-badge shipping-free">
                <Truck className="w-3 h-3 mr-1" />
                무료배송
              </span>
            ) : shippingFee > 0 ? (
              <span className="shipping-badge">
                <Truck className="w-3 h-3 mr-1" />
                배송비 {formatPrice(shippingFee)}원
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}
