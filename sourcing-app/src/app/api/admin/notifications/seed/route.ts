/**
 * 소싱 알림 더미 데이터 시드 API
 * POST /api/admin/notifications/seed
 *
 * Prisma enum 업데이트 전에도 동작하도록 Raw SQL 사용
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 기존 sourcing 알림 개수 확인
    const existingCountResult = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) as cnt FROM notification WHERE section = 'sourcing'
    `
    const existingCount = Number(existingCountResult[0]?.cnt || 0)

    // Raw SQL로 더미 데이터 삽입 (enum 타입 우회)
    await prisma.$executeRaw`
      INSERT INTO notification (section, type, title, message, link, is_read, created_at)
      VALUES
        ('sourcing', 'COLLECT', '상품 수집이 완료되었습니다', '[도매밴드] 15개 상품 수집 완료', '/sourcing/automation/logs', 0, NOW()),
        ('sourcing', 'TRANSFORM', 'AI 변환이 완료되었습니다', '10개 상품 변환 완료 (성공 9개, 실패 1개)', '/sourcing/automation/logs', 0, NOW()),
        ('sourcing', 'PUBLISH', '상품 발행이 완료되었습니다', '[소매밴드1] 8개 상품 발행 완료 (성공 8개)', '/sourcing/automation/logs', 0, NOW()),
        ('sourcing', 'ERROR', '오류가 발생했습니다 (AI변환)', 'API 할당량 초과로 변환이 중단되었습니다.', '/sourcing/automation/logs', 0, NOW()),
        ('sourcing', 'INFO', '전체 파이프라인 실행 완료', '수집→변환→등록→발행 완료 (성공: 35, 실패: 2)', '/sourcing/automation/logs', 1, NOW())
    `

    return NextResponse.json({
      success: true,
      message: '5개의 소싱 알림 더미 데이터가 생성되었습니다.',
      data: {
        createdCount: 5,
        existingCount,
        totalCount: existingCount + 5,
      },
    })
  } catch (error: any) {
    console.error('소싱 알림 시드 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message || '더미 데이터 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
