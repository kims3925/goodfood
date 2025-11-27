'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, ShoppingCart, User, Menu, Heart, X } from 'lucide-react'

interface ShopHeaderProps {
  cartItemCount?: number
}

export default function ShopHeader({ cartItemCount = 0 }: ShopHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const categories = [
    { name: '홈', href: '/' },
    { name: '오늘특가', href: '/deals' },
    { name: '베스트', href: '/best' },
    { name: '신상품', href: '/new' },
    { name: '카테고리', href: '/category' },
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`
    }
  }

  return (
    <header className="bg-white shadow-header sticky top-0 z-50">
      {/* Top Bar */}
      <div className="border-b border-gray-100">
        <div className="container-main">
          <div className="flex items-center justify-between h-12 text-xs text-gray-600">
            <div className="flex items-center space-x-4">
              <Link href="/" className="font-bold text-primary-500 text-lg">
                SHOP
              </Link>
            </div>
            <div className="hidden sm:flex items-center space-x-4">
              <Link href="/login" className="hover:text-gray-900">로그인</Link>
              <span className="text-gray-300">|</span>
              <Link href="/signup" className="hover:text-gray-900">회원가입</Link>
              <span className="text-gray-300">|</span>
              <Link href="/orders" className="hover:text-gray-900">주문조회</Link>
              <span className="text-gray-300">|</span>
              <Link href="/cs" className="hover:text-gray-900">고객센터</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container-main">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-primary-500">SHOP</h1>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:block">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상품명 또는 브랜드 입력"
                className="search-input"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </form>

          {/* Icons */}
          <div className="flex items-center space-x-4">
            <button
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            <Link
              href="/wishlist"
              className="hidden md:flex p-2 text-gray-600 hover:text-gray-900"
            >
              <Heart className="w-6 h-6" />
            </Link>

            <Link
              href="/cart"
              className="relative p-2 text-gray-600 hover:text-gray-900"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-sale rounded-full text-white text-xs flex items-center justify-center">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </Link>

            <Link
              href="/mypage"
              className="hidden md:flex p-2 text-gray-600 hover:text-gray-900"
            >
              <User className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </div>

      {/* Category Navigation */}
      <nav className="border-t border-gray-100 hidden md:block">
        <div className="container-main">
          <ul className="category-nav h-12">
            {categories.map((category) => (
              <li key={category.name}>
                <Link
                  href={category.href}
                  className="category-item py-3 block"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 animate-slide-up">
          {/* Mobile Search */}
          <div className="p-4">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="상품명 또는 브랜드 입력"
                  className="search-input"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>

          {/* Mobile Navigation */}
          <ul className="border-t border-gray-100">
            {categories.map((category) => (
              <li key={category.name} className="border-b border-gray-100">
                <Link
                  href={category.href}
                  className="block px-4 py-3 text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>

          {/* Mobile User Links */}
          <div className="p-4 bg-gray-50">
            <div className="flex items-center space-x-4">
              <Link
                href="/wishlist"
                className="flex items-center text-gray-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Heart className="w-5 h-5 mr-2" />
                찜한상품
              </Link>
              <Link
                href="/mypage"
                className="flex items-center text-gray-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <User className="w-5 h-5 mr-2" />
                마이페이지
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
