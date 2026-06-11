/**
 * GET /api/v1/categories — 카테고리 트리 (STEP 4-3, scope: products:read)
 * 응답: { data: CategoryNode[] } (활성 카테고리만, 트리 구조)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { authenticateApiRequest, logApiCall } from '@/lib/openapi/auth'

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'products:read')
  if (auth instanceof NextResponse) return auth

  try {
    const categories = await prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, code: true, name: true, parentId: true, depth: true, sortOrder: true },
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
    })

    interface Node {
      code: string
      name: string
      depth: number
      children: Node[]
    }
    const nodeById = new Map<number, Node & { parentId: number | null }>()
    const roots: Node[] = []
    for (const c of categories) {
      nodeById.set(c.id, { code: c.code, name: c.name, depth: c.depth, parentId: c.parentId, children: [] })
    }
    for (const node of nodeById.values()) {
      if (node.parentId && nodeById.has(node.parentId)) {
        nodeById.get(node.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    const res = NextResponse.json({ data: roots })
    logApiCall(auth, req, 200)
    return res
  } catch (error: any) {
    logApiCall(auth, req, 500)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '카테고리 조회에 실패했습니다.' } },
      { status: 500 }
    )
  }
}
