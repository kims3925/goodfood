export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/shop/check-duplicate
 * 도메인 또는 쇼핑몰명 중복 체크
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const subdomain = searchParams.get('subdomain')
    const name = searchParams.get('name')
    const excludeId = searchParams.get('excludeId') // 수정 시 자기 자신 제외

    if (!subdomain && !name) {
      return NextResponse.json(
        { success: false, error: 'subdomain 또는 name 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    const result: {
      subdomain?: { isDuplicate: boolean; message?: string }
      name?: { isDuplicate: boolean; message?: string }
    } = {}

    // 도메인 중복 체크
    if (subdomain) {
      const existingBySubdomain = await prisma.shop.findFirst({
        where: {
          subdomain: subdomain.toLowerCase(),
          ...(excludeId && { id: { not: parseInt(excludeId) } }),
        },
        select: { id: true },
      })

      result.subdomain = {
        isDuplicate: !!existingBySubdomain,
        message: existingBySubdomain ? '이미 사용 중인 도메인입니다.' : undefined,
      }
    }

    // 쇼핑몰명 중복 체크
    if (name) {
      const existingByName = await prisma.shop.findFirst({
        where: {
          name: name,
          ...(excludeId && { id: { not: parseInt(excludeId) } }),
        },
        select: { id: true },
      })

      result.name = {
        isDuplicate: !!existingByName,
        message: existingByName ? '이미 사용 중인 쇼핑몰명입니다.' : undefined,
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('중복 체크 실패:', error)
    return NextResponse.json(
      { success: false, error: '중복 체크에 실패했습니다.' },
      { status: 500 }
    )
  }
}
