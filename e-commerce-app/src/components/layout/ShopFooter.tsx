'use client'

import Link from 'next/link'

export default function ShopFooter() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      {/* Footer Navigation */}
      <div className="container-main py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">SHOP</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              최고의 상품을 최저가로 제공하는<br />
              믿을 수 있는 온라인 쇼핑몰입니다.
            </p>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">고객센터</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/cs/faq" className="hover:text-gray-900">
                  자주 묻는 질문
                </Link>
              </li>
              <li>
                <Link href="/cs/inquiry" className="hover:text-gray-900">
                  1:1 문의
                </Link>
              </li>
              <li>
                <Link href="/cs/notice" className="hover:text-gray-900">
                  공지사항
                </Link>
              </li>
              <li className="pt-2">
                <span className="font-semibold text-gray-900">1588-0000</span>
                <p className="text-xs text-gray-500">평일 09:00 - 18:00</p>
              </li>
            </ul>
          </div>

          {/* Shopping Guide */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">쇼핑 안내</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/guide/shipping" className="hover:text-gray-900">
                  배송 안내
                </Link>
              </li>
              <li>
                <Link href="/guide/return" className="hover:text-gray-900">
                  교환/반품 안내
                </Link>
              </li>
              <li>
                <Link href="/guide/payment" className="hover:text-gray-900">
                  결제 안내
                </Link>
              </li>
              <li>
                <Link href="/guide/membership" className="hover:text-gray-900">
                  회원 혜택
                </Link>
              </li>
            </ul>
          </div>

          {/* Policy */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">정책 안내</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/policy/terms" className="hover:text-gray-900">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/policy/privacy" className="hover:text-gray-900 font-semibold">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="/policy/youth" className="hover:text-gray-900">
                  청소년보호정책
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Business Info */}
      <div className="border-t border-gray-200">
        <div className="container-main py-6">
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              <span className="font-medium">상호명:</span> 주식회사 쇼핑몰 |{' '}
              <span className="font-medium">대표:</span> 홍길동 |{' '}
              <span className="font-medium">사업자등록번호:</span> 123-45-67890
            </p>
            <p>
              <span className="font-medium">통신판매업신고:</span> 제2024-서울강남-0000호 |{' '}
              <span className="font-medium">주소:</span> 서울특별시 강남구 테헤란로 123
            </p>
            <p>
              <span className="font-medium">이메일:</span> cs@shop.com |{' '}
              <span className="font-medium">호스팅 서비스:</span> AWS
            </p>
            <p className="pt-2">
              당사는 통신판매중개자이며, 통신판매의 당사자가 아닙니다.
              상품, 상품정보, 거래에 관한 의무와 책임은 판매자에게 있습니다.
            </p>
          </div>

          {/* Copyright */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              Copyright © {new Date().getFullYear()} SHOP. All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
