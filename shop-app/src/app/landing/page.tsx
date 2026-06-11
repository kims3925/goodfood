import Link from 'next/link'
import type { Metadata } from 'next'
import prisma from '@bandauto/db'

// 상품 그리드: 60초 캐시 (오너클랜식 메인 상품 노출)
export const revalidate = 60

// 굿푸드몰 랜딩페이지 (2026-06-11)
// 루트(goodshop.hublink.im) 접속 시 middleware가 이 페이지로 rewrite.
// - 쇼핑몰 입장: /goodfood/main (기본 샵)
// - 관리자 로그인: goodshop-admin.hublink.im (sourcing-app 어드민)

export const metadata: Metadata = {
  title: '굿푸드몰 — 식품 도매 B2B 공급 플랫폼',
  description:
    '산지·도매 직소싱 식품을 AI가 가공해 공급하는 B2B 도매 플랫폼. 오픈 API로 내 쇼핑몰에 바로 연동하세요.',
}

const ADMIN_URL = 'https://goodshop-admin.hublink.im'
const SHOP_PATH = '/goodfood/main'

async function getLandingProducts() {
  try {
    const items = await prisma.shopProduct.findMany({
      where: {
        deletedAt: null,
        shop: { subdomain: 'goodfood', deletedAt: null, isActive: true },
        product: { deletedAt: null, isActive: true },
      },
      include: {
        product: {
          select: { id: true, name: true, price: true, thumbnailUrl: true, categoryId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    })
    return items.map((sp) => sp.product).filter((p): p is NonNullable<typeof p> => !!p)
  } catch {
    return []
  }
}

export default async function LandingPage() {
  const products = await getLandingProducts()
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white text-gray-900">
      {/* 헤더 */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥬</span>
          <span className="text-xl font-extrabold tracking-tight text-emerald-700">굿푸드몰</span>
          <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            B2B 공급몰
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href={SHOP_PATH}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            쇼핑몰
          </Link>
          <a
            href={ADMIN_URL}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            관리자 로그인
          </a>
        </nav>
      </header>

      {/* 히어로 */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 text-center">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          좋은 먹거리, <span className="text-emerald-600">도매가 그대로.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
          산지·도매처에서 직소싱한 식품을 AI가 상품화하여 공급합니다.
          <br className="hidden sm:block" />
          판매자는 오픈 API 하나로 내 쇼핑몰에 상품·재고·주문을 연동할 수 있습니다.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={SHOP_PATH}
            className="rounded-xl bg-emerald-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
          >
            쇼핑몰 입장하기 →
          </Link>
          <a
            href={ADMIN_URL}
            className="rounded-xl border border-gray-300 bg-white px-7 py-3.5 text-base font-bold text-gray-800 transition hover:border-gray-400 hover:bg-gray-50"
          >
            관리자 로그인
          </a>
        </div>
      </section>

      {/* 공급 상품 (오너클랜식 메인 노출) */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-bold">오늘의 공급 상품</h2>
          <Link href={SHOP_PATH} className="text-sm font-semibold text-emerald-700 hover:underline">
            전체 상품 보기 →
          </Link>
        </div>
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center text-sm text-gray-500">
            상품 준비 중입니다. 어드민에서 소싱·발행을 시작하면 이곳에 자동으로 노출됩니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/goodfood/product/${p.id}`}
                className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-square w-full overflow-hidden bg-gray-100">
                  {p.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnailUrl}
                      alt={p.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">🥬</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="mt-1 text-base font-bold text-emerald-700">
                    {p.price ? `${p.price.toLocaleString()}원` : '가격 문의'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 특징 */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
            <div className="text-3xl">🚛</div>
            <h3 className="mt-4 text-lg font-bold">도매 직소싱</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              산지·도매 네트워크에서 매일 상품을 수집하고, 품절·가격 변동을 모니터링해 신선한
              공급 정보를 유지합니다.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
            <div className="text-3xl">🤖</div>
            <h3 className="mt-4 text-lg font-bold">AI 상품 가공</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              수집된 원본 게시물을 AI가 상품명·옵션·상세설명으로 자동 가공하여 바로 판매 가능한
              상품으로 발행합니다.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
            <div className="text-3xl">🔌</div>
            <h3 className="mt-4 text-lg font-bold">오픈 API 연동</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              OAuth2 기반 REST API로 상품 조회·발주를 연동하세요. 카페24 등 외부 쇼핑몰에서
              굿푸드몰 상품을 그대로 판매할 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* API 안내 */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-2xl bg-gray-900 p-8 text-white sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold">판매자를 위한 오픈 API</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">
                B2B 판매자 승인 후 API 키(Client ID/Secret)를 발급받아 사용합니다. 토큰 발급 후
                상품 목록·상세·품절 상태 조회와 발주 생성을 지원합니다.
              </p>
              <p className="mt-4 text-xs text-gray-400">
                문의: <a className="underline" href="mailto:skkim3925@gmail.com">skkim3925@gmail.com</a>
              </p>
            </div>
            <pre className="w-full max-w-md overflow-x-auto rounded-xl bg-black/40 p-5 text-xs leading-relaxed text-emerald-300 sm:w-auto">
{`# 1) 액세스 토큰 발급
POST /api/v1/oauth/token
  grant_type=client_credentials
  Authorization: Basic {clientId:secret}

# 2) 상품 조회
GET /api/v1/products?limit=50
  Authorization: Bearer {token}

# 3) 발주 생성
POST /api/v1/orders
  Authorization: Bearer {token}`}
            </pre>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} 굿푸드몰 (GoodFood Mall) · 식품 도매 B2B 공급 플랫폼
      </footer>
    </main>
  )
}
