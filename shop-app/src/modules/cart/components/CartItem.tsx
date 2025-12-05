'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Minus, Plus, X } from 'lucide-react'

interface CartItemProps {
  id: number
  productId: number
  productName: string
  optionSummary?: string
  thumbnailUrl?: string
  unitPrice: number
  quantity: number
  onQuantityChange: (id: number, quantity: number) => void
  onRemove: (id: number) => void
}

export default function CartItem({
  id,
  productId,
  productName,
  optionSummary,
  thumbnailUrl,
  unitPrice,
  quantity,
  onQuantityChange,
  onRemove,
}: CartItemProps) {
  const [imageError, setImageError] = useState(false)

  const formatPrice = (value: number) => {
    return value.toLocaleString('ko-KR')
  }

  const totalPrice = unitPrice * quantity

  const handleDecrease = () => {
    if (quantity > 1) {
      onQuantityChange(id, quantity - 1)
    }
  }

  const handleIncrease = () => {
    onQuantityChange(id, quantity + 1)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 1) {
      onQuantityChange(id, value)
    }
  }

  return (
    <div className="cart-item animate-fade-in">
      {/* Checkbox */}
      <div className="flex items-center">
        <input type="checkbox" className="checkbox" defaultChecked />
      </div>

      {/* Product Image */}
      <Link href={`/product/${productId}`} className="flex-shrink-0">
        <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden bg-gray-100">
          {thumbnailUrl && !imageError ? (
            <Image
              src={thumbnailUrl}
              alt={productName}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-gray-400 text-xs">No Image</span>
            </div>
          )}
        </div>
      </Link>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/product/${productId}`}>
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-primary-500">
            {productName}
          </h3>
        </Link>
        {optionSummary && (
          <p className="mt-1 text-xs text-gray-500">{optionSummary}</p>
        )}
        <p className="mt-2 text-sm font-semibold text-gray-900 md:hidden">
          {formatPrice(unitPrice)}원
        </p>
      </div>

      {/* Unit Price (Desktop) */}
      <div className="hidden md:block text-center w-28">
        <span className="text-sm font-medium text-gray-900">
          {formatPrice(unitPrice)}원
        </span>
      </div>

      {/* Quantity Selector */}
      <div className="quantity-selector">
        <button
          onClick={handleDecrease}
          disabled={quantity <= 1}
          className="quantity-btn disabled:opacity-50"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={quantity}
          onChange={handleInputChange}
          className="quantity-input focus:outline-none"
        />
        <button onClick={handleIncrease} className="quantity-btn">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Total Price */}
      <div className="text-right w-24 md:w-32">
        <span className="text-sm md:text-base font-bold text-gray-900">
          {formatPrice(totalPrice)}원
        </span>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(id)}
        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}
