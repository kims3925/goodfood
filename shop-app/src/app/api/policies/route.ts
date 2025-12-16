import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export async function GET() {
  try {
    // 이용약관: main 버전이 가장 크고, 그 중 sub 버전이 가장 큰 것
    const termsPolicy = await prisma.termsPolicy.findFirst({
      orderBy: [
        { main: 'desc' },
        { sub: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        content: true,
        main: true,
        sub: true,
      },
    })

    // 개인정보처리방침: main 버전이 가장 크고, 그 중 sub 버전이 가장 큰 것
    const privacyPolicy = await prisma.privacyPolicy.findFirst({
      orderBy: [
        { main: 'desc' },
        { sub: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        content: true,
        main: true,
        sub: true,
      },
    })

    return NextResponse.json({
      success: true,
      terms: termsPolicy,
      privacy: privacyPolicy,
    })
  } catch (error) {
    console.error('Failed to fetch policies:', error)
    return NextResponse.json(
      { success: false, error: '약관 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
