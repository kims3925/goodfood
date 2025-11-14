import { NextRequest, NextResponse } from 'next/server'
import { loadAISettings, saveAISettings } from '@/lib/config/storage'

/**
 * GET /api/settings/ai
 * AI 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    const settings = loadAISettings()

    return NextResponse.json({
      success: true,
      settings
    })

  } catch (error) {
    console.error('AI 설정 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '설정을 조회할 수 없습니다.'
    }, { status: 500 })
  }
}

/**
 * POST /api/settings/ai
 * AI 설정 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 파일에 저장
    const saved = saveAISettings(body)

    if (!saved) {
      return NextResponse.json({
        success: false,
        error: '설정 저장에 실패했습니다.'
      }, { status: 500 })
    }

    // 저장된 설정 다시 로드
    const settings = loadAISettings()

    return NextResponse.json({
      success: true,
      message: 'AI 설정이 저장되었습니다.',
      settings
    })

  } catch (error) {
    console.error('AI 설정 저장 실패:', error)
    return NextResponse.json({
      success: false,
      error: '설정 저장 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/ai
 * AI 설정 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const { deleteAISettings } = await import('@/lib/config/storage')
    const deleted = deleteAISettings()

    return NextResponse.json({
      success: deleted,
      message: deleted ? '설정이 삭제되었습니다.' : '삭제할 설정이 없습니다.'
    })

  } catch (error) {
    console.error('AI 설정 삭제 실패:', error)
    return NextResponse.json({
      success: false,
      error: '설정 삭제 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}