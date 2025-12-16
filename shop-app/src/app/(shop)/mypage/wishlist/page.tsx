'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import { ConfirmModal } from '@/modules/common/ui-kit/src/ui'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useShop } from '@/contexts/ShopContext'

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
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { getPath, getApiPath } = useShopUrl()
  const { shop } = useShop()
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'
  const [wishlists, setWishlists] = useState<Wishlist[]>([])
  const [loading, setLoading] = useState(true)

  // 로그인 체크 - 미로그인 시 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (status === 'unauthenticated') {
      const callbackUrl = encodeURIComponent(pathname)
      router.replace(getPath(`/auth/login?callbackUrl=${callbackUrl}`))
    }
  }, [status, router, pathname, getPath])
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
      const response = await fetch(getApiPath('/api/mypage/wishlist'))
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
      const response = await fetch(getApiPath(`/api/mypage/wishlist/${pendingRemoveId}`), {
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

  // 세션 로딩 중이거나 인증되지 않은 경우 로딩 표시
  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: primaryColor }}></div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: primaryColor }}></div>
      </div>
    )
  }

  return (
    <>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">찜한 상품</h1>
        <p className="text-gray-600">관심있는 상품을 모아보세요</p>
      </div>

      {/* 찜한 상품 목록 */}
      {wishlists.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg w-full">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">찜한 상품이 없습니다</p>
          <Link
            href={getPath('/main')}
            className="inline-block px-6 py-3 text-white rounded-md hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            쇼핑 시작하기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
          {wishlists.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              <Link href={getPath(`/product/${item.product.id}`)}>
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
                      <ShoppingCart className="w-12 h-12 lg:w-16 lg:h-16 text-gray-300" />
                    </div>
                  )}
                </div>
              </Link>

              <div className="p-3 lg:p-4">
                <Link href={getPath(`/product/${item.product.id}`)}>
                  <h3 className="font-medium text-gray-900 mb-1 lg:mb-2 line-clamp-2 text-sm lg:text-base hover:opacity-70">
                    {item.product.name}
                  </h3>
                </Link>

                <div className="flex items-center justify-between mb-3 lg:mb-4">
                  <span className="text-base lg:text-lg font-bold text-gray-900">
                    {formatPrice(item.product.price)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={getPath(`/product/${item.product.id}`)}
                    className="flex-1 px-3 lg:px-4 py-2 text-white rounded-md hover:opacity-90 text-center text-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    상품보기
                  </Link>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="px-3 lg:px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
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
    </>
  )
}
