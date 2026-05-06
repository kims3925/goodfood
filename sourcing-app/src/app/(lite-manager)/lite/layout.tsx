/**
 * SNSAUTO Lite Manager — 라이트 레이아웃 (서버 컴포넌트)
 * 사용자 mode 에 따라 메뉴 구성이 달라짐:
 * - lite      : 기본 7개 메뉴
 * - lite_band : + 📡 내 밴드 / 🚀 발행 결과 (lite_band 전용 2개)
 */
import { ReactNode } from 'react'
import OrderNotifier from './_components/OrderNotifier'
import LiteSidebar from './_components/LiteSidebar'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'

export default async function LiteLayout({ children }: { children: ReactNode }) {
  const me = await getCurrentUser()
  let mode: 'lite' | 'lite_band' = 'lite'
  let isAdmin = false

  if (me) {
    const u = await prisma.user.findUnique({
      where: { id: me.userId },
      select: { mode: true, role: true },
    })
    if (u?.mode === 'lite_band') mode = 'lite_band'
    if (u?.role === 'ADMIN') isAdmin = true
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="flex">
        <LiteSidebar mode={mode} isAdmin={isAdmin} />
        <main className="flex-1 p-6 max-w-[1400px]">{children}</main>
      </div>

      <OrderNotifier />
    </div>
  )
}
