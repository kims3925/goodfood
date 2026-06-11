/**
 * 카테고리 단건 관리 API (B2B 공급몰 전환 STEP 1-2)
 *
 * PATCH  /api/admin/categories/[id] — 수정 { name?, sortOrder?, isActive?, parentId? }
 * DELETE /api/admin/categories/[id] — soft delete (하위 카테고리/소속 상품 있으면 차단)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

async function requireAdmin() {
  const me = await getCurrentUser()
  if (!me) {
    return { error: NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 }) }
  }
  if (me.role !== 'ADMIN') {
    return { error: NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 }) }
  }
  return { me }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  try {
    const category = await prisma.category.findFirst({ where: { id, deletedAt: null } })
    if (!category) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 })
    }

    const data: any = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (Number.isFinite(Number(body.sortOrder))) data.sortOrder = Math.floor(Number(body.sortOrder))
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive

    // 부모 변경 (트리 이동) — 자기 자신/자기 후손으로 이동 금지, 최대 3단계
    if (body.parentId !== undefined) {
      if (body.parentId === null) {
        data.parentId = null
        data.depth = 1
      } else {
        const newParentId = Number(body.parentId)
        if (newParentId === id) {
          return NextResponse.json({ success: false, error: '자기 자신을 부모로 지정할 수 없습니다.' }, { status: 400 })
        }
        const parent = await prisma.category.findFirst({
          where: { id: newParentId, deletedAt: null },
          select: { id: true, depth: true, parentId: true },
        })
        if (!parent) {
          return NextResponse.json({ success: false, error: '부모 카테고리를 찾을 수 없습니다.' }, { status: 404 })
        }
        // 순환 방지: 새 부모의 조상 체인에 자신이 있으면 차단
        let cursor = parent.parentId
        while (cursor != null) {
          if (cursor === id) {
            return NextResponse.json({ success: false, error: '하위 카테고리를 부모로 지정할 수 없습니다.' }, { status: 400 })
          }
          const up: { parentId: number | null } | null = await prisma.category.findUnique({
            where: { id: cursor },
            select: { parentId: true },
          })
          cursor = up?.parentId ?? null
        }
        if (parent.depth >= 3) {
          return NextResponse.json({ success: false, error: '카테고리는 최대 3단계까지 가능합니다.' }, { status: 400 })
        }
        // 자식이 있는 카테고리를 depth 3 아래로 이동하면 4단계가 되므로 차단
        const childCount = await prisma.category.count({ where: { parentId: id, deletedAt: null } })
        if (childCount > 0 && parent.depth >= 2) {
          return NextResponse.json(
            { success: false, error: '하위 카테고리가 있어 해당 위치로 이동할 수 없습니다 (최대 3단계).' },
            { status: 400 }
          )
        }
        data.parentId = parent.id
        data.depth = parent.depth + 1
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.category.update({ where: { id }, data })
      // depth 가 바뀌었으면 직계 자식 depth 동기화 (최대 3단계 제약상 1레벨만 존재)
      if (data.depth !== undefined) {
        await tx.category.updateMany({
          where: { parentId: id, deletedAt: null },
          data: { depth: data.depth + 1 },
        })
      }
      return result
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[Admin Categories PATCH]', error)
    return NextResponse.json(
      { success: false, error: error?.message || '카테고리 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  try {
    const category = await prisma.category.findFirst({ where: { id, deletedAt: null } })
    if (!category) {
      return NextResponse.json({ success: false, error: '카테고리를 찾을 수 없습니다.' }, { status: 404 })
    }

    const childCount = await prisma.category.count({ where: { parentId: id, deletedAt: null } })
    if (childCount > 0) {
      return NextResponse.json(
        { success: false, error: `하위 카테고리 ${childCount}개가 있어 삭제할 수 없습니다. 하위를 먼저 정리해주세요.` },
        { status: 409 }
      )
    }

    const productCount = await prisma.product.count({
      where: { categoryId: category.code, deletedAt: null },
    })
    if (productCount > 0) {
      return NextResponse.json(
        { success: false, error: `이 카테고리에 상품 ${productCount}개가 있어 삭제할 수 없습니다. 비활성화를 사용하거나 상품을 이동해주세요.` },
        { status: 409 }
      )
    }

    await prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Admin Categories DELETE]', error)
    return NextResponse.json(
      { success: false, error: error?.message || '카테고리 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
