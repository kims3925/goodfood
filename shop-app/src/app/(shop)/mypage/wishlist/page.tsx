'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import { ConfirmModal } from '@/modules/common/ui-kit/src/ui'

interface Wishlist {
  id: number
  addedAt: string
  product: {
    id: number
    name: string
    description: string | null
    thumbnailUrl: string | null
    price: number | null
    currency: string
  }
}

export default function WishlistPage() {
  const { data: session } = useSession()
  const [wishlists, setWishlists] = useState<Wishlist[]>([])
  const [loading, setLoading] = useState(true)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null)

  useEffect(() => {
    if (session) {
      fetchWishlists()
    }
  }, [session])

  const fetchWishlists = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/mypage/wishlist')
      const data = await response.json()

      if (data.success) {
        setWishlists(data.wishlists)
      }
    } catch (error) {
      console.error('Failed to fetch wishlists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = (wishlistId: number) => {
    setPendingRemoveId(wishlistId)
    setShowRemoveConfirm(true)
  }

  const confirmRemove = async () => {
    if (!pendingRemoveId) return

    try {
      const response = await fetch(`/api/mypage/wishlist/${pendingRemoveId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        fetchWishlists()
      }
    } catch (error) {
      console.error('Failed to remove wishlist:', error)
    }

    setPendingRemoveId(null)
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '가격 문의'
    return new Intl.NumberFormat('ko-KR').format(price) + '원'
  }

  if (loading) {
    return (
      <div className="kurly-container py-12">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B] mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="kurly-container py-12">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">찜한 상품</h1>
        <p className="text-gray-600">관심있는 상품을 모아보세요</p>
      </div>

      {/* 찜한 상품 목록 */}
      {wishlists.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">찜한 상품이 없습니다</p>
          <Link
            href="/main"
            className="inline-block px-6 py-3 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252]"
          >
            쇼핑 시작하기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {wishlists.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              <Link href={`/product/${item.product.id}`}>
                <div className="aspect-square bg-gray-100 relative">
                  {item.product.thumbnailUrl ? (
                    <Image
                      src={item.product.thumbnailUrl}
                      alt={item.product.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingCart className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                </div>
              </Link>

              <div className="p-4">
                <Link href={`/product/${item.product.id}`}>
                  <h3 className="font-medium text-gray-900 mb-2 line-clamp-2 hover:text-[#FF6B6B]">
                    {item.product.name}
                  </h3>
                </Link>

                {item.product.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {item.product.description}
                  </p>
                )}

                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-bold text-gray-900">
                    {formatPrice(item.product.price)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/product/${item.product.id}`}
                    className="flex-1 px-4 py-2 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252] text-center text-sm"
                  >
                    상품보기
                  </Link>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => {
          setShowRemoveConfirm(false)
          setPendingRemoveId(null)
        }}
        onConfirm={confirmRemove}
        title="찜 목록 삭제"
        message="찜한 상품에서 삭제하시겠습니까?"
        confirmText="삭제"
        variant="danger"
      />
    </div>
  )
}
