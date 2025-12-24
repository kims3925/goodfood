export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { inquiryService } from '@/modules/sourcing/domain/src/cs'

// GET: 모든 문의 목록 조회 (관리자용)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as any
    const status = searchParams.get('status') as any

    const inquiries = await inquiryService.getList({ type, status })

    return NextResponse.json({
      success: true,
      inquiries,
    })
  } catch (error) {
    console.error('Failed to fetch inquiries:', error)
    return NextResponse.json(
      { success: false, error: '문의 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
