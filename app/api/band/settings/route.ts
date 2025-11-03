import { NextResponse } from 'next/server'

// 메모리에 임시 저장 (실제로는 DB나 환경변수 사용)
let bandApiSettings = {
  clientId: '',
  clientSecret: '',
  accessToken: ''
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      settings: {
        ...bandApiSettings,
        clientSecret: bandApiSettings.clientSecret ? '********' : '', // 보안을 위해 마스킹
        accessToken: bandApiSettings.accessToken ? '********' : '' // 보안을 위해 마스킹
      }
    })
  } catch (error) {
    console.error('Failed to load band API settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load settings',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const settings = await req.json()

    // 설정 유효성 검사
    if (!settings.clientId || !settings.clientSecret || !settings.accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'All fields are required (Client ID, Client Secret, Access Token)',
        },
        { status: 400 }
      )
    }

    // 설정 저장 (실제로는 암호화하여 DB에 저장)
    bandApiSettings = {
      clientId: settings.clientId,
      clientSecret: settings.clientSecret,
      accessToken: settings.accessToken
    }

    return NextResponse.json({
      success: true,
      message: '밴드 API 설정이 저장되었습니다.',
    })
  } catch (error) {
    console.error('Failed to save band API settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save settings',
      },
      { status: 500 }
    )
  }
}