export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { settingsService } from '@/modules/config/domain/src/settings'

// GET: 프롬프트 설정 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const settings = await settingsService.getPromptSettings(currentUser.userId)

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('프롬프트 설정 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '프롬프트 설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 프롬프트 설정 저장
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { promptType, settings } = body

    if (!promptType || !settings?.prompt) {
      return NextResponse.json(
        { success: false, error: '프롬프트 타입과 내용은 필수입니다.' },
        { status: 400 }
      )
    }

    const promptConfig = await settingsService.savePromptSettings(
      currentUser.userId,
      promptType,
      {
        name: settings.name || '상품 변환 프롬프트',
        prompt: settings.prompt,
        description: settings.description || null,
      }
    )

    return NextResponse.json({ success: true, data: promptConfig })
  } catch (error: any) {
    console.error('프롬프트 설정 저장 실패:', error)

    if (error.message === '지원하지 않는 프롬프트 타입입니다.') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: '프롬프트 설정 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 프롬프트 설정 삭제 (기본값으로 복구)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const promptType = searchParams.get('promptType')

    if (!promptType) {
      return NextResponse.json(
        { success: false, error: '프롬프트 타입이 필요합니다.' },
        { status: 400 }
      )
    }

    await settingsService.deletePromptSettings(currentUser.userId, promptType)

    return NextResponse.json({ success: true, message: '기본값으로 복구되었습니다.' })
  } catch (error) {
    console.error('프롬프트 설정 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '프롬프트 설정 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
