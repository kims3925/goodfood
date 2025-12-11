'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { Search, ShoppingCart, User, MapPin, ChevronDown, Phone, HelpCircle, MessageSquare, LogOut } from 'lucide-react'
import { CartNotificationProvider, useCartNotification } from '@/contexts/CartNotificationContext'
import CartNotificationBubble from '@/components/cart/CartNotificationBubble'
import { useShop } from '@/contexts/ShopContext'
import { useShopUrl } from '@/hooks/useShopUrl'
import { formatPhoneNumber } from '@/modules/common/utils/src/helpers/phone'

function StoreLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const { shop } = useShop()
  const { getPath, slug } = useShopUrl()
  const { cartCount } = useCartNotification()
  const [searchQuery, setSearchQuery] = useState('')
  const [isCustomerServiceOpen, setIsCustomerServiceOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  // Shop 정보
  const shopName = shop?.name || 'ABC마켓'
  const logoUrl = shop?.theme?.logoUrl
  const contactPhone = shop?.contactPhone || '1234-5678'
  const relatedShops = shop?.relatedShops || []

  // 경로 기반 URL 생성 (다른 Shop으로 이동)
  const getShopUrl = (shopSlug: string) => {
    // 개발 환경
    const isDev = process.env.NODE_ENV !== 'production'

    if (isDev) {
      return `/${shopSlug}/main`
    }

    // 프로덕션: 같은 도메인, 경로만 변경
    return `/${shopSlug}/main`
  }


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `${getPath('/main')}?search=${encodeURIComponent(searchQuery)}`
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="kurly-header border-b border-gray-200">
        {/* Top Utility Bar */}
        <div className="border-b border-gray-100 bg-white">
          <div className="kurly-container">
            <div className="flex justify-end items-center h-8 text-xs text-gray-600 gap-1">
              {status === 'loading' ? (
                <span className="px-2 text-gray-400">로딩중...</span>
              ) : session ? (
                <>
                  {/* Logged In State */}
                  <div className="relative">
                    <button
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center gap-1 hover:text-abc-coral px-2"
                    >
                      <span className="flex items-center gap-0.5">
                        <span className="font-medium text-abc-coral">{session.user?.name || '회원'}</span>
                        <span className="text-gray-600">님</span>
                      </span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isUserMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsUserMenuOpen(false)}
                        />
                        <div className="absolute top-full right-0 w-[160px] bg-white border border-gray-200 shadow-lg z-50 py-2 mt-1 rounded-md">
                          <Link
                            href={getPath('/mypage')}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <User className="w-4 h-4" />
                            마이페이지
                          </Link>
                          <Link
                            href={getPath('/mypage/orders')}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <ShoppingCart className="w-4 h-4" />
                            주문내역
                          </Link>
                          <hr className="my-1" />
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false)
                              // 현재 쇼핑몰 경로 유지하며 메인페이지로 리다이렉트
                              signOut({ callbackUrl: `${window.location.origin}${getPath('/main')}` })
                            }}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700 w-full"
                          >
                            <LogOut className="w-4 h-4" />
                            로그아웃
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Logged Out State */}
                  <Link href={getPath('/auth/signup')} className="hover:text-abc-coral px-2">
                    회원가입
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link href={getPath('/auth/login')} className="hover:text-abc-coral px-2">
                    로그인
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link href={getPath('/order/lookup')} className="hover:text-abc-coral px-2">
                    비회원 주문조회
                  </Link>
                </>
              )}
              <span className="text-gray-300">|</span>

              {/* Customer Service Accordion */}
              <div className="relative">
                <button
                  onClick={() => setIsCustomerServiceOpen(!isCustomerServiceOpen)}
                  className="flex items-center gap-1 hover:text-abc-coral px-2"
                >
                  고객센터
                  <ChevronDown className={`w-3 h-3 transition-transform ${isCustomerServiceOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCustomerServiceOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCustomerServiceOpen(false)}
                    />
                    <div className="absolute top-full right-0 w-[200px] bg-white border border-gray-200 shadow-lg z-50 py-2 mt-1 rounded-md">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="font-bold text-lg text-abc-coral">{formatPhoneNumber(contactPhone)}</p>
                        <p className="text-gray-500 text-xs mt-1">월~토 오전 7시 ~ 오후 6시</p>
                      </div>
                      <Link
                        href={getPath('/cs/faq')}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => setIsCustomerServiceOpen(false)}
                      >
                        <HelpCircle className="w-4 h-4" />
                        자주묻는질문
                      </Link>
                      <Link
                        href={getPath('/cs/inquiry')}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => setIsCustomerServiceOpen(false)}
                      >
                        <MessageSquare className="w-4 h-4" />
                        1:1 문의
                      </Link>
                      <Link
                        href={getPath('/cs')}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => setIsCustomerServiceOpen(false)}
                      >
                        <Phone className="w-4 h-4" />
                        고객센터
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="kurly-container">
          <div className="kurly-header-top">
            {/* Logo - 로고 이미지 + Shop 이름 */}
            <Link href={getPath('/main')} className="kurly-logo flex items-center gap-2">
              {logoUrl && (
                <Image
                  src={logoUrl}
                  alt={`${shopName} 로고`}
                  width={120}
                  height={48}
                  className="h-8 md:h-10 lg:h-12 w-auto object-contain"
                  unoptimized
                />
              )}
              <span className="text-xl md:text-2xl lg:text-3xl font-black text-abc-coral">
                {shopName}
              </span>
            </Link>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="kurly-search">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="검색어를 입력해주세요"
                  className="kurly-search-input"
                />
                <button
                  type="submit"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-abc-coral"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </form>

            {/* Header Icons */}
            <div className="kurly-header-icons">
              <Link href={getPath('/mypage/addresses')} className="kurly-header-icon hidden md:flex">
                <MapPin className="w-5 h-5 md:w-6 md:h-6" />
                <span className="kurly-header-icon-text">배송지</span>
              </Link>
              <Link href={getPath('/mypage/wishlist')} className="kurly-header-icon hidden sm:flex">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="kurly-header-icon-text">찜하기</span>
              </Link>
              <div className="relative">
                <Link href={getPath('/cart')} className="kurly-header-icon relative">
                  <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-abc-coral text-white text-[10px] md:text-xs rounded-full flex items-center justify-center">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                  <span className="kurly-header-icon-text">장바구니</span>
                </Link>
                {/* 장바구니 알림 버블 */}
                <CartNotificationBubble />
              </div>
            </div>
          </div>
        </div>

      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="kurly-footer">
        <div className="kurly-container">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            <div>
              <h4 className="font-bold text-gray-900 mb-3 md:mb-4">고객행복센터</h4>
              <p className="text-xl md:text-2xl font-bold mb-2 text-abc-coral">{formatPhoneNumber(contactPhone)}</p>
              <p className="text-xs md:text-sm text-gray-600">월~토 오전 7시 ~ 오후 6시</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-3 md:mb-4">{shopName}</h4>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-gray-600">
                <li><Link href={getPath('/about')} className="hover:opacity-70">회사소개</Link></li>
                <li><Link href={getPath('/careers')} className="hover:opacity-70">채용정보</Link></li>
                <li><Link href={getPath('/terms')} className="hover:opacity-70">이용약관</Link></li>
                <li><Link href={getPath('/privacy')} className="hover:opacity-70">개인정보처리방침</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-3 md:mb-4">고객센터</h4>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-gray-600">
                <li><Link href={getPath('/cs')} className="hover:opacity-70">고객센터</Link></li>
                <li><Link href={getPath('/cs/faq')} className="hover:opacity-70">자주묻는질문</Link></li>
                <li><Link href={getPath('/cs/inquiry')} className="hover:opacity-70">1:1문의</Link></li>
              </ul>
            </div>
            {relatedShops.length > 0 ? (
              <div>
                <h4 className="font-bold text-gray-900 mb-3 md:mb-4">관련 쇼핑몰</h4>
                <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-gray-600">
                  {relatedShops.map((s) => (
                    <li key={s.id}>
                      <a
                        href={getShopUrl(s.subdomain)}
                        className="flex items-center gap-2 hover:opacity-70"
                      >
                        {s.logoUrl ? (
                          <Image src={s.logoUrl} alt={s.name} width={60} height={16} className="h-4 w-auto" unoptimized />
                        ) : null}
                        <span>{s.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                <h4 className="font-bold text-gray-900 mb-3 md:mb-4">SNS</h4>
                <div className="flex gap-3 md:gap-4">
                  <a href="#" className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300">
                    <span className="text-gray-600 text-sm md:text-base">f</span>
                  </a>
                  <a href="#" className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300">
                    <span className="text-gray-600 text-sm md:text-base">in</span>
                  </a>
                  <a href="#" className="w-8 h-8 md:w-10 md:h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300">
                    <span className="text-gray-600 text-sm md:text-base">yt</span>
                  </a>
                </div>
              </div>
            )}
          </div>
          <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-gray-200 text-center text-xs md:text-sm text-gray-500">
            <p>{shopName} | 대표: 홍길동 | 사업자등록번호: 123-45-67890</p>
            <p className="mt-2">Copyright &copy; 2024 {shopName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Provider로 감싸서 export
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CartNotificationProvider>
      <StoreLayoutContent>{children}</StoreLayoutContent>
    </CartNotificationProvider>
  )
}
