'use client'

import ProductCard from './ProductCard'

interface Product {
  id: number
  name: string
  price: number
  originalPrice?: number
  thumbnailUrl?: string
  isFreeShipping?: boolean
  shippingFee?: number
  badges?: Array<'sale' | 'new' | 'best'>
  isWishlisted?: boolean
}

interface ProductGridProps {
  products: Product[]
  columns?: 2 | 3 | 4 | 5
  onWishlistClick?: (id: number) => void
}

export default function ProductGrid({
  products,
  columns = 4,
  onWishlistClick,
}: ProductGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <p className="text-lg font-medium">상품이 없습니다</p>
        <p className="text-sm mt-2">다른 카테고리를 확인해보세요</p>
      </div>
    )
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4 md:gap-6`}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          {...product}
          onWishlistClick={onWishlistClick}
        />
      ))}
    </div>
  )
}
