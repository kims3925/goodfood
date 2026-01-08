'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { Search, ShoppingCart, User, MapPin, ChevronDown, Phone, MessageSquare, LogOut, Home, Headphones, Trophy } from 'lucide-react'
import { CartNotificationProvider, useCartNotification } from '@/contexts/CartNotificationContext'
import CartNotificationBubble from '@/components/cart/CartNotificationBubble'
import { useShop } from '@/contexts/ShopContext'
import { useShopUrl } from '@/hooks/useShopUrl'
import { formatPhoneNumber } from '@/modules/common/utils/src/helpers/phone'

// 사업자등록번호 포맷팅 (XXX-XX-XXXXX 형식)
const formatBusinessNumber = (number: string): string => {
  const cleaned = number.replace(/[^0-9]/g, '')
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`
  }
  return number
}

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
  const ownerName = shop?.ownerName
  const businessNumber = shop?.businessNumber

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
        {/* Mobile Top Bar - 쇼핑몰 이름만 표시 */}
        <div className="md:hidden border-b border-gray-100 bg-white">
          <div className="kurly-container">
            <div className="flex justify-center items-center h-14">
              <Link href={getPath('/main')} className="flex items-center gap-2">
                {logoUrl && (
                  <Image
                    src={logoUrl}
                    alt={`${shopName} 로고`}
                    width={120}
                    height={48}
                    className="h-10 w-auto object-contain"
                    unoptimized
                  />
                )}
                <span className="text-2xl font-bold text-abc-coral">
                  {shopName}
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Desktop Top Utility Bar - 모바일에서 숨김 */}
        <div className="hidden md:block border-b border-gray-100 bg-white">
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
                        <p className="text-gray-500 text-xs mt-1">월~금 오전 10시 ~ 오후 5시</p>
                      </div>
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
            {/* Logo - 로고 이미지 + Shop 이름 (데스크탑만) */}
            <Link href={getPath('/main')} className="kurly-logo hidden md:flex items-center gap-2">
              {logoUrl && (
                <Image
                  src={logoUrl}
                  alt={`${shopName} 로고`}
                  width={120}
                  height={48}
                  className="h-10 lg:h-12 w-auto object-contain"
                  unoptimized
                />
              )}
              <span className="text-2xl lg:text-3xl font-black text-abc-coral">
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

            {/* Header Icons - 데스크탑에서만 표시 */}
            <div className="kurly-header-icons hidden md:flex">
              <Link href={getPath('/mypage/addresses')} className="kurly-header-icon">
                <MapPin className="w-6 h-6" />
                <span className="kurly-header-icon-text">배송지</span>
              </Link>
              <Link href={getPath('/mypage/wishlist')} className="kurly-header-icon">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="kurly-header-icon-text">찜하기</span>
              </Link>
              <div className="relative">
                <Link href={getPath('/cart')} className="kurly-header-icon relative">
                  <ShoppingCart className="w-6 h-6" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-abc-coral text-white text-xs rounded-full flex items-center justify-center">
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

      {/* Main Content - 모바일에서 하단 네비 공간 확보 */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* Mobile Bottom Navigation - 모바일에서만 표시 */}
      <nav className="mobile-bottom-nav md:hidden">
        <Link href={getPath('/main')} className="mobile-nav-item">
          <Home />
          <span>홈</span>
        </Link>
        <Link href={getPath('/cart')} className="mobile-nav-item relative">
          <ShoppingCart />
          {cartCount > 0 && (
            <span className="absolute -top-1 left-1/2 ml-2 w-5 h-5 bg-abc-coral text-white text-[10px] rounded-full flex items-center justify-center">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
          <span>장바구니</span>
        </Link>

        {/* 중앙 플로팅 인기상품 버튼 */}
        <Link href={getPath('/popular')} className="mobile-nav-center">
          <div className="mobile-nav-center-btn">
            <Trophy />
          </div>
          <span className="mobile-nav-center-label">인기</span>
        </Link>

        <Link href={getPath('/mypage')} className="mobile-nav-item">
          <User />
          <span>MY</span>
        </Link>
        <Link href={getPath('/cs')} className="mobile-nav-item">
          <Headphones />
          <span>고객센터</span>
        </Link>
      </nav>

      {/* Footer - 모바일에서는 하단 네비 위에 표시 */}
      <footer className="kurly-footer mb-16 md:mb-0">
        <div className="kurly-container">
          {/* 고객행복센터 - 모바일에서 상단 중앙 */}
          <div className="text-center mb-4 md:hidden">
            <h4 className="font-bold text-gray-900 mb-2">고객행복센터</h4>
            <p className="text-xl font-bold text-abc-coral">{formatPhoneNumber(contactPhone)}</p>
            <p className="text-xs text-gray-600">월~금 오전 10시 ~ 오후 5시</p>
          </div>

          {/* 모바일: 쇼핑몰명/고객센터 2열, 데스크탑: 3열 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
            {/* 고객행복센터 - 데스크탑에서만 */}
            <div className="hidden md:block text-left">
              <h4 className="font-bold text-gray-900 mb-4">고객행복센터</h4>
              <p className="text-2xl font-bold mb-2 text-abc-coral">{formatPhoneNumber(contactPhone)}</p>
              <p className="text-sm text-gray-600">월~금 오전 10시 ~ 오후 5시</p>
            </div>
            <div className="text-center md:text-left">
              <h4 className="font-bold text-gray-900 mb-2 md:mb-4 text-sm md:text-base">{shopName}</h4>
              <ul className="space-y-1 text-xs md:text-sm text-gray-600">
                <li><Link href={getPath('/terms')} className="hover:opacity-70">이용약관</Link></li>
                <li><Link href={getPath('/privacy')} className="hover:opacity-70">개인정보처리방침</Link></li>
              </ul>
            </div>
            <div className="text-center md:text-left">
              <h4 className="font-bold text-gray-900 mb-2 md:mb-4 text-sm md:text-base">고객센터</h4>
              <ul className="space-y-1 text-xs md:text-sm text-gray-600">
                <li><Link href={getPath('/cs')} className="hover:opacity-70">고객센터</Link></li>
                <li><Link href={getPath('/cs/inquiry')} className="hover:opacity-70">1:1문의</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-4 md:mt-8 pt-4 md:pt-8 border-t border-gray-200 text-center text-xs md:text-sm text-gray-500">
            <p>
              {shopName}
              {ownerName && <span> | 대표: {ownerName}</span>}
              {businessNumber && <span> | 사업자등록번호: {formatBusinessNumber(businessNumber)}</span>}
            </p>
            <p className="mt-1 md:mt-2">Copyright &copy; {new Date().getFullYear()} {shopName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Provider로 감싸서 export
export default function StoreLayout({
  children,

}:
 {
  children: React.ReactNode
}) {
  return (
    <CartNotificationProvider>
      <StoreLayoutContent>{children}</StoreLayoutContent>
    </CartNotificationProvider>
  )
}
