import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loadAPISettings, saveAPISettings } from '@/lib/config-storage'

// GET: API 설정 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 설정 파일에서 로드
    const apiSettings = loadAPISettings()

    return NextResponse.json({
      success: true,
      settings: apiSettings
    })

  } catch (error) {
    console.error('API 설정 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'API 설정을 불러올 수 없습니다.'
    }, { status: 500 })
  }
}

// POST: API 설정 저장
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { provider, settings } = await request.json()

    if (!provider || !settings) {
      return NextResponse.json({
        success: false,
        error: 'API 제공자와 설정 정보가 필요합니다.'
      }, { status: 400 })
    }

    // 기존 설정 로드
    const currentSettings = loadAPISettings()

    // 특정 제공자의 설정만 업데이트
    const updatedSettings = {
      ...currentSettings,
      [provider]: settings
    }

    // 설정 파일에 저장
    saveAPISettings(updatedSettings)

    console.log(`✅ ${provider} API 설정 저장 완료`)

    return NextResponse.json({
      success: true,
      message: 'API 설정이 저장되었습니다.'
    })

  } catch (error) {
    console.error('API 설정 저장 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'API 설정 저장 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
