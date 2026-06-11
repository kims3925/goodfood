/**
 * 카테고리 트리 관리 API (B2B 공급몰 전환 STEP 1-2)
 *
 * GET  /api/admin/categories — 전체 카테고리 트리 (비활성 포함, 어드민용)
 * POST /api/admin/categories — 카테고리 생성 { code, name, parentId?, sortOrder? }
 *
 * 카테고리는 플랫폼 공통 데이터(테넌트 격리 없음) — ADMIN 전용.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const CODE_RE = /^[A-Z0-9_]{2,100}$/

interface CategoryNode {
  id: number
  code: string
  name: string
  parentId: number | null
  depth: number
  sortOrder: number
  isActive: boolean
  productCount?: number
  children: CategoryNode[]
}

export async function GET() {
  const me = await getCurrentUser()
  if (!me) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (me.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

  try {
    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    })

    // 카테고리별 상품 수 (categoryId 문자열 = code 매칭)
    const productCounts = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { deletedAt: null },
      _count: { _all: true },
    })
    const countByCode = new Map<string, number>(
      productCounts
        .filter((p) => p.categoryId != null)
        .map((p) => [p.categoryId as string, p._count._all])
    )

    // 평면 목록 → 트리 조립
    const nodeById = new Map<number, CategoryNode>()
    const roots: CategoryNode[] = []
    for (const c of categories) {
      nodeById.set(c.id, {
        id: c.id,
        code: c.code,
        name: c.name,
        parentId: c.parentId,
        depth: c.depth,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        productCount: countByCode.get(c.code) ?? 0,
        children: [],
      })
    }
    for (const node of nodeById.values()) {
      if (node.parentId && nodeById.has(node.parentId)) {
        nodeById.get(node.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return NextResponse.json({ success: true, data: roots })
  } catch (error: any) {
    console.error('[Admin Categories GET]', error)
    return NextResponse.json(
      { success: false, error: '카테고리 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (me.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const code = String(body?.code || '').toUpperCase().trim()
  const name = String(body?.name || '').trim()
  const parentIdRaw = body?.parentId
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Math.floor(Number(body.sortOrder)) : 0

  if (!CODE_RE.test(code)) {
    return NextResponse.json(
      { success: false, error: '코드는 2~100자 영대문자/숫자/언더스코어만 가능합니다.' },
      { status: 400 }
    )
  }
  if (!name) {
    return NextResponse.json({ success: false, error: '이름은 필수입니다.' }, { status: 400 })
  }

  try {
    // 부모 검증 + depth 계산 (최대 3단계)
    let parentId: number | null = null
    let depth = 1
    if (parentIdRaw != null) {
      const parent = await prisma.category.findFirst({
        where: { id: Number(parentIdRaw), deletedAt: null },
        select: { id: true, depth: true },
      })
      if (!parent) {
        return NextResponse.json({ success: false, error: '부모 카테고리를 찾을 수 없습니다.' }, { status: 404 })
      }
      if (parent.depth >= 3) {
        return NextResponse.json({ success: false, error: '카테고리는 최대 3단계까지 가능합니다.' }, { status: 400 })
      }
      parentId = parent.id
      depth = parent.depth + 1
    }

    const exists = await prisma.category.findUnique({ where: { code }, select: { id: true, deletedAt: true } })
    if (exists && !exists.deletedAt) {
      return NextResponse.json({ success: false, error: '이미 사용 중인 코드입니다.' }, { status: 409 })
    }

    // soft-deleted 동일 코드가 있으면 복원하며 갱신 (code unique 제약)
    const category = exists
      ? await prisma.category.update({
          where: { code },
          data: { name, parentId, depth, sortOrder, isActive: true, deletedAt: null },
        })
      : await prisma.category.create({
          data: { code, name, parentId, depth, sortOrder },
        })

    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (error: any) {
    console.error('[Admin Categories POST]', error)
    return NextResponse.json(
      { success: false, error: error?.message || '카테고리 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
