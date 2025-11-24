import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getCurrentUser } from '@/modules/auth/auth.service'

const prisma = new PrismaClient()

// GET: API 설정 조회
export async function GET(request: NextRequest) {
  try {
    // 세션에서 userId 가져오기
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: '로그인이 필요합니다.',
        },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    // 사용자의 API 설정 조회
    const configs = await prisma.sourcingApiConfig.findMany({
      where: {
        userId: userId,
      },
    })

    // 설정을 플랫폼별로 매핑
    const settings = {
      band: {
        clientId: '',
        clientSecret: '',
        accessToken: '',
        refreshToken: '',
      },
      aliexpress: {
        apiKey: '',
        appSecret: '',
        accessToken: '',
        trackingId: '',
      },
    }

    // Band API 설정
    const bandConfig = configs.find((c) => c.platform === 'BAND')
    if (bandConfig) {
      settings.band = {
        clientId: '',
        clientSecret: '',
        accessToken: bandConfig.accessToken || '',
        refreshToken: '',
      }
    }

    // AliExpress API 설정
    const aliexpressConfig = configs.find((c) => c.platform === 'ALIEXPRESS')
    if (aliexpressConfig) {
      const metadata = aliexpressConfig.metadata as any
      settings.aliexpress = {
        apiKey: aliexpressConfig.apiKey || '',
        appSecret: metadata?.appSecret || '',
        accessToken: aliexpressConfig.accessToken || '',
        trackingId: metadata?.trackingId || '',
      }
    }

    return NextResponse.json({
      success: true,
      settings,
    })
  } catch (error) {
    console.error('API 설정 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'API 설정을 불러오는데 실패했습니다.',
      },
      { status: 500 }
    )
  }
}

// POST: API 설정 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, settings } = body

    console.log('[API 설정 저장] 요청 받음:', { provider, settings })

    // 세션에서 userId 가져오기
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: '로그인이 필요합니다.',
        },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    // 플랫폼 매핑
    const platformMap: Record<string, string> = {
      band: 'BAND',
      aliexpress: 'ALIEXPRESS',
    }

    const platform = platformMap[provider]
    console.log('[API 설정 저장] 플랫폼 매핑:', platform)

    if (!platform) {
      return NextResponse.json(
        {
          success: false,
          error: '지원하지 않는 플랫폼입니다.',
        },
        { status: 400 }
      )
    }

    // 기존 설정 확인
    const existingConfig = await prisma.sourcingApiConfig.findFirst({
      where: {
        userId: userId,
        platform,
      },
    })

    console.log('[API 설정 저장] 기존 설정:', existingConfig ? `ID: ${existingConfig.id}` : '없음')

    // 저장할 데이터 준비
    const configData: any = {
      userId: userId,
      platform,
      isActive: true,
    }

    if (provider === 'band') {
      // Band: Access Token만 저장 (자동 갱신 없음, 만료 시 수동 재입력)
      configData.accessToken = settings.accessToken || null
      configData.refreshToken = null
      configData.metadata = {}
    } else if (provider === 'aliexpress') {
      // AliExpress: apiKey는 직접 필드에, appSecret/trackingId는 metadata에
      configData.apiKey = settings.apiKey || null
      configData.accessToken = settings.accessToken || null
      configData.metadata = {
        appSecret: settings.appSecret || null,
        trackingId: settings.trackingId || null,
      }
    }

    console.log('[API 설정 저장] 저장할 데이터:', configData)

    // Upsert (업데이트 또는 생성)
    let config
    if (existingConfig) {
      // 기존 설정 업데이트
      console.log('[API 설정 저장] 기존 설정 업데이트 시작')
      config = await prisma.sourcingApiConfig.update({
        where: { id: existingConfig.id },
        data: configData,
      })
      console.log('[API 설정 저장] 업데이트 완료:', config.id)
    } else {
      // 새 설정 생성
      console.log('[API 설정 저장] 새 설정 생성 시작')
      config = await prisma.sourcingApiConfig.create({
        data: configData,
      })
      console.log('[API 설정 저장] 생성 완료:', config.id)
    }

    return NextResponse.json({
      success: true,
      data: config,
    })
  } catch (error) {
    console.error('API 설정 저장 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'API 설정 저장에 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
