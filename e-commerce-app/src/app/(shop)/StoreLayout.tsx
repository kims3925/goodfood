'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Search, ShoppingCart, User, MapPin, Menu, ChevronDown, Phone, HelpCircle, MessageSquare, LogOut } from 'lucide-react'
import { CartNotificationProvider } from '@/contexts/CartNotificationContext'
import CartNotificationBubble from '@/components/cart/CartNotificationBubble'
import { useChannel } from '@/contexts/ChannelContext'

function StoreLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const { channel } = useChannel()
  const [cartCount, setCartCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [isCustomerServiceOpen, setIsCustomerServiceOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  // 채널 정보
  const channelName = channel?.displayName || channel?.name || 'ABC마켓'
  const logoUrl = channel?.theme?.logoUrl
  const primaryColor = channel?.theme?.primaryColor || '#FF6B6B'
  const contactPhone = channel?.contactPhone || '1234-5678'
  const footerText = channel?.theme?.footerText
  const relatedChannels = channel?.relatedChannels || []

  // 서브도메인 기반 URL 생성
  const getChannelUrl = (subdomain: string) => {
    // 개발 환경에서는 lvh.me 사용
    const isDev = process.env.NODE_ENV !== 'production'

    if (isDev) {
      return `http://${subdomain}.lvh.me:3000/main`
    }

    // 프로덕션: 환경변수에서 루트 도메인 사용
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'shop.com'
    return `https://${subdomain}.${rootDomain}/main`
  }

  useEffect(() => {
    // Load cart count from localStorage
    const loadCartCount = async () => {
      try {
        const sessionId = localStorage.getItem('sessionId')
        if (sessionId) {
          const response = await fetch(`/api/cart?sessionId=${sessionId}`)
          const data = await response.json()
          if (data.success && data.cart?.items) {
            setCartCount(data.cart.items.length)
          }
        }
      } catch (error) {
        console.error('Failed to load cart:', error)
      }
    }
    loadCartCount()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `?search=${encodeURIComponent(searchQuery)}`
    }
  }

  const categories = [
    { name: '채소', icon: '🥬', href: '?category=채소' },
    { name: '과일', icon: '🍎', href: '?category=과일' },
    { name: '육류', icon: '🥩', href: '?category=육류' },
    { name: '수산물', icon: '🐟', href: '?category=수산물' },
    { name: '김치/반찬', icon: '🥢', href: '?category=김치' },
    { name: '가공식품', icon: '📦', href: '?category=가공식품' },
    { name: '냉동/간편식', icon: '🍱', href: '?category=냉동식품' },
    { name: '건강식품', icon: '💊', href: '?category=건강식품' },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="kurly-header border-b border-gray-200">
        {/* Top Banner */}
        <div
          className="text-white text-center py-2 text-sm"
          style={{ background: `linear-gradient(to right, ${primaryColor}, ${primaryColor}dd)` }}
        >
          <span>{channelName} 오픈 기념! 전 상품 무료배송</span>
        </div>

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
                      className="flex items-center gap-1 hover:text-[#FF6B6B] px-2"
                    >
                      <span className="flex items-center gap-0.5">
                        <span className="font-medium text-[#FF6B6B]">{session.user?.name || '회원'}</span>
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
                            href="/mypage"
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <User className="w-4 h-4" />
                            마이페이지
                          </Link>
                          <Link
                            href="/mypage/orders"
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
                              signOut({ callbackUrl: '' })
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
                  <Link href="/auth/signup" className="hover:text-[#FF6B6B] px-2">
                    회원가입
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link href="/auth/login" className="hover:text-[#FF6B6B] px-2">
                    로그인
                  </Link>
                </>
              )}
              <span className="text-gray-300">|</span>

              {/* Customer Service Accordion */}
              <div className="relative">
                <button
                  onClick={() => setIsCustomerServiceOpen(!isCustomerServiceOpen)}
                  className="flex items-center gap-1 hover:text-[#FF6B6B] px-2"
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
                        <p className="font-bold text-lg" style={{ color: primaryColor }}>{contactPhone}</p>
                        <p className="text-gray-500 text-xs mt-1">월~토 오전 7시 ~ 오후 6시</p>
                      </div>
                      <Link
                        href="/cs/faq"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => setIsCustomerServiceOpen(false)}
                      >
                        <HelpCircle className="w-4 h-4" />
                        자주묻는질문
                      </Link>
                      <Link
                        href="/cs/inquiry"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                        onClick={() => setIsCustomerServiceOpen(false)}
                      >
                        <MessageSquare className="w-4 h-4" />
                        1:1 문의
                      </Link>
                      <Link
                        href="/cs"
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
            {/* Logo - 항상 채널 이름으로 표시 */}
            <Link href="/main" className="kurly-logo flex items-center gap-2">
              <span
                className="text-xl md:text-2xl lg:text-3xl font-black"
                style={{ color: primaryColor }}
              >
                {channelName}
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FF6B6B]"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </form>

            {/* Header Icons */}
            <div className="kurly-header-icons">
              <Link href="/mypage/addresses" className="kurly-header-icon hidden md:flex">
                <MapPin className="w-5 h-5 md:w-6 md:h-6" />
                <span className="kurly-header-icon-text">배송지</span>
              </Link>
              <Link href="/mypage/wishlist" className="kurly-header-icon hidden sm:flex">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="kurly-header-icon-text">찜하기</span>
              </Link>
              <div className="relative">
                <Link href="/cart" className="kurly-header-icon relative">
                  <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-[#FF6B6B] text-white text-[10px] md:text-xs rounded-full flex items-center justify-center">
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

        {/* Navigation */}
        <nav className="kurly-nav">
          <div className="kurly-container">
            <div className="kurly-nav-inner">
              {/* Category Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className="kurly-nav-category"
                >
                  <Menu className="w-5 h-5" />
                  <span>카테고리</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Category Dropdown Menu */}
                {isCategoryOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCategoryOpen(false)}
                    />
                    <div className="absolute top-full left-0 w-[240px] bg-white border border-gray-200 shadow-lg z-50 py-2">
                      {categories.map((cat) => (
                        <Link
                          key={cat.name}
                          href={cat.href}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                          onClick={() => setIsCategoryOpen(false)}
                        >
                          <span className="text-xl">{cat.icon}</span>
                          <span className="text-gray-700">{cat.name}</span>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Navigation Links */}
              <div className="kurly-nav-links">
                <Link href="/main" className="kurly-nav-link">신상품</Link>
                <Link href="?filter=best" className="kurly-nav-link">베스트</Link>
                <Link href="?filter=sale" className="kurly-nav-link text-[#fa622f] font-bold">특가/혜택</Link>
                <Link href="?filter=event" className="kurly-nav-link">이벤트</Link>
              </div>

            </div>
          </div>
        </nav>
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
              <p className="text-xl md:text-2xl font-bold mb-2" style={{ color: primaryColor }}>{contactPhone}</p>
              <p className="text-xs md:text-sm text-gray-600">월~토 오전 7시 ~ 오후 6시</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-3 md:mb-4">{channelName}</h4>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-gray-600">
                <li><Link href="/about" className="hover:opacity-70">회사소개</Link></li>
                <li><Link href="/careers" className="hover:opacity-70">채용정보</Link></li>
                <li><Link href="/terms" className="hover:opacity-70">이용약관</Link></li>
                <li><Link href="/privacy" className="hover:opacity-70">개인정보처리방침</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-3 md:mb-4">고객센터</h4>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-gray-600">
                <li><Link href="/cs" className="hover:opacity-70">고객센터</Link></li>
                <li><Link href="/cs/faq" className="hover:opacity-70">자주묻는질문</Link></li>
                <li><Link href="/cs/inquiry" className="hover:opacity-70">1:1문의</Link></li>
              </ul>
            </div>
            {relatedChannels.length > 0 ? (
              <div>
                <h4 className="font-bold text-gray-900 mb-3 md:mb-4">관련 쇼핑몰</h4>
                <ul className="space-y-1 md:space-y-2 text-xs md:text-sm text-gray-600">
                  {relatedChannels.map((ch) => (
                    <li key={ch.id}>
                      <a
                        href={getChannelUrl(ch.subdomain)}
                        className="flex items-center gap-2 hover:opacity-70"
                      >
                        {ch.logoUrl ? (
                          <img src={ch.logoUrl} alt={ch.name} className="h-4 w-auto" />
                        ) : null}
                        <span>{ch.displayName || ch.name}</span>
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
            {footerText ? (
              <p dangerouslySetInnerHTML={{ __html: footerText }} />
            ) : (
              <>
                <p>{channelName} | 대표: 홍길동 | 사업자등록번호: 123-45-67890</p>
                <p className="mt-2">Copyright &copy; 2024 {channelName}. All rights reserved.</p>
              </>
            )}
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
