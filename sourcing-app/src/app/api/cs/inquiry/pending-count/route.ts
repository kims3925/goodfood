export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { inquiryService } from '@/modules/sourcing/domain/src/cs'

export async function GET() {
  try {
    const count = await inquiryService.getPendingCount()

    return NextResponse.json({
      success: true,
      count,
    })
  } catch (error) {
    console.error('Failed to fetch pending inquiry count:', error)
    return NextResponse.json(
      { success: false, error: '미답변 문의 수를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
