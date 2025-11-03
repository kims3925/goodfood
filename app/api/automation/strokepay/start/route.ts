import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import StrokePayAutomation from '@/lib/strokepay-automation'

// 전역 자동화 인스턴스 (세션별 관리 가능)
const automationInstances = new Map<string, StrokePayAutomation>()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { options = {} } = await request.json()
    
    console.log('🚀 스룩페이 자동화 브라우저 시작 요청')

    // 기존 인스턴스가 있으면 종료
    const existingInstance = automationInstances.get(session.user.id)
    if (existingInstance) {
      await existingInstance.closeBrowser()
    }

    // 새로운 자동화 인스턴스 생성
    const automation = new StrokePayAutomation()
    
    // 브라우저 시작
    await automation.startBrowser({
      headless: false, // 사용자가 볼 수 있도록 항상 화면 표시
      ...options
    })
    
    // 로그인 페이지로 이동
    await automation.navigateToLogin()
    
    // 인스턴스 저장
    automationInstances.set(session.user.id, automation)
    
    console.log('✅ 브라우저 시작 및 로그인 페이지 이동 완료')

    return NextResponse.json({
      success: true,
      message: '브라우저가 시작되었습니다. 스룩페이 업로드 과정을 진행해주세요.',
      instructions: [
        '1. 로그인 정보를 입력하고 로그인하세요',
        '2. 상품 등록 페이지로 이동하세요',
        '3. 엑셀 파일을 업로드하세요',
        '4. 모든 과정이 완료되면 /api/automation/strokepay/generate-script를 호출하여 스크립트를 생성하세요'
      ]
    })

  } catch (error) {
    console.error('❌ 스룩페이 자동화 시작 실패:', error)
    return NextResponse.json({
      success: false,
      error: '브라우저 시작에 실패했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    console.log('🛑 브라우저 종료 요청')

    // 해당 사용자의 자동화 인스턴스 종료
    const automation = automationInstances.get(session.user.id)
    if (automation) {
      await automation.closeBrowser()
      automationInstances.delete(session.user.id)
      console.log('✅ 브라우저 종료 완료')
    }

    return NextResponse.json({
      success: true,
      message: '브라우저가 종료되었습니다.'
    })

  } catch (error) {
    console.error('❌ 브라우저 종료 실패:', error)
    return NextResponse.json({
      success: false,
      error: '브라우저 종료에 실패했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// 자동화 인스턴스 가져오기 (다른 API에서 사용)
export function getAutomationInstance(userId: string): StrokePayAutomation | null {
  return automationInstances.get(userId) || null
}