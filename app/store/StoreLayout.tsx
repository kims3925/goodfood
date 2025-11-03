'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, Search, ShoppingCart, User, Home, Grid3X3, Heart, UserCircle } from 'lucide-react'

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Mobile Sidebar */}
        <div className={`fixed inset-0 z-50 ${isSidebarOpen ? 'block' : 'hidden'}`}>
          <div className="fixed inset-0 bg-black opacity-50" onClick={() => setIsSidebarOpen(false)}></div>
          <nav className="fixed top-0 left-0 bottom-0 flex flex-col w-5/6 max-w-sm py-6 px-6 bg-white border-r overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-gray-900">가족함께 스토어</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">카테고리</h3>
              <nav className="space-y-1">
                <Link href="/store" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">전체상품</Link>
                <Link href="/store?category=meat" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">육류</Link>
                <Link href="/store?category=seafood" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">수산물</Link>
                <Link href="/store?category=vegetable" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">채소</Link>
                <Link href="/store?category=fruit" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">과일</Link>
                <Link href="/store?category=kimchi" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">김치/반찬</Link>
                <Link href="/store?category=processed" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">가공식품</Link>
              </nav>
              
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">특별 기획</h3>
                <nav className="space-y-1">
                  <Link href="/store?filter=sale" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">
                    <span className="text-red-500 font-semibold">타임특가</span>
                  </Link>
                  <Link href="/store?filter=best" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">베스트상품</Link>
                  <Link href="/store?filter=new" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">신상품</Link>
                </nav>
              </div>
              
              <div className="mt-6 pt-6 border-t">
                <nav className="space-y-1">
                  <Link href="/store/mypage" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">마이페이지</Link>
                  <Link href="/store/orders" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">주문내역</Link>
                  <Link href="/store/wishlist" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">찜한상품</Link>
                  <Link href="/store/notice" className="block py-2 px-3 text-gray-700 rounded hover:bg-gray-100">공지사항</Link>
                </nav>
              </div>
            </div>
          </nav>
        </div>

        {/* Header */}
        <header className="sticky top-0 z-40 bg-white shadow-sm">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              {/* Left Section */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2"
                >
                  <Menu className="h-6 w-6" />
                </button>
                <Link href="/store" className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900 hidden sm:inline">가족함께 스토어</span>
                  <span className="text-lg font-bold text-gray-900 sm:hidden">가족</span>
                </Link>
              </div>

              {/* Center Section - Search (Hidden) */}
              <div className="hidden flex-1 max-w-xl mx-4">
                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder="상품 검색..."
                    className="w-full px-4 py-2 pl-10 pr-4 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-blue-500"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* Right Section */}
              <div className="flex items-center gap-2">
                <Link href="/store/search" className="p-2">
                  <Search className="h-5 w-5" />
                </Link>
                <Link href="/store/cart" className="p-2 relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <Link href="/store/mypage" className="p-2">
                  <User className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Category Bar (Hidden) */}
          <nav className="hidden border-t">
            <div className="container mx-auto px-4">
              <div className="flex items-center gap-6 py-2">
                <Link href="/store" className="text-sm font-medium text-gray-700 hover:text-blue-600">전체상품</Link>
                <Link href="/store?category=meat" className="text-sm font-medium text-gray-700 hover:text-blue-600">육류</Link>
                <Link href="/store?category=seafood" className="text-sm font-medium text-gray-700 hover:text-blue-600">수산물</Link>
                <Link href="/store?category=vegetable" className="text-sm font-medium text-gray-700 hover:text-blue-600">채소</Link>
                <Link href="/store?category=fruit" className="text-sm font-medium text-gray-700 hover:text-blue-600">과일</Link>
                <Link href="/store?category=kimchi" className="text-sm font-medium text-gray-700 hover:text-blue-600">김치/반찬</Link>
                <Link href="/store?category=processed" className="text-sm font-medium text-gray-700 hover:text-blue-600">가공식품</Link>
                <span className="text-gray-300">|</span>
                <Link href="/store?filter=sale" className="text-sm font-bold text-red-500 hover:text-red-600">⚡ 타임특가</Link>
                <Link href="/store?filter=best" className="text-sm font-medium text-gray-700 hover:text-blue-600">베스트</Link>
                <Link href="/store?filter=new" className="text-sm font-medium text-gray-700 hover:text-blue-600">신상품</Link>
              </div>
            </div>
          </nav>
        </header>

        {/* Main Content */}
        <main className="min-h-screen pb-16">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-40">
          <div className="flex items-center justify-around py-2">
            <Link href="/store" className="flex flex-col items-center py-1 px-3">
              <Home className="h-5 w-5 text-gray-600" />
              <span className="text-xs text-gray-600 mt-1">홈</span>
            </Link>
            <Link href="/store/category" className="flex flex-col items-center py-1 px-3">
              <Grid3X3 className="h-5 w-5 text-gray-600" />
              <span className="text-xs text-gray-600 mt-1">카테고리</span>
            </Link>
            <Link href="/store/wishlist" className="flex flex-col items-center py-1 px-3">
              <Heart className="h-5 w-5 text-gray-600" />
              <span className="text-xs text-gray-600 mt-1">찜</span>
            </Link>
            <Link href="/store/mypage" className="flex flex-col items-center py-1 px-3">
              <UserCircle className="h-5 w-5 text-gray-600" />
              <span className="text-xs text-gray-600 mt-1">마이페이지</span>
            </Link>
          </div>
        </nav>
    </div>
  )
}
