import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAutomationInstance } from '../start/route'
import path from 'path'
import fs from 'fs'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    console.log('🤖 자동화 스크립트 생성 요청')

    // 자동화 인스턴스 가져오기
    const automation = getAutomationInstance(session.user.id)
    
    if (!automation) {
      return NextResponse.json({
        success: false,
        error: '활성화된 브라우저 세션이 없습니다. 먼저 브라우저를 시작해주세요.'
      }, { status: 400 })
    }

    // 기록된 액션들 가져오기
    const actions = await automation.getRecordedActions()
    
    if (actions.length === 0) {
      return NextResponse.json({
        success: false,
        error: '기록된 액션이 없습니다. 스룩페이에서 업로드 과정을 진행해주세요.'
      }, { status: 400 })
    }

    console.log(`📋 ${actions.length}개의 액션이 기록됨`)

    // 자동화 스크립트 생성
    const script = await automation.generateAutomationScript(actions)
    
    // 스크립트 파일 저장
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    const filename = `strokepay-automation-${timestamp}.js`
    const scriptPath = await automation.saveAutomationScript(script, filename)

    console.log('✅ 자동화 스크립트 생성 완료')

    // 액션 요약 생성
    const actionSummary = actions.reduce((acc, action) => {
      acc[action.type] = (acc[action.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      message: '자동화 스크립트가 생성되었습니다.',
      data: {
        scriptPath,
        filename,
        actionCount: actions.length,
        actionSummary,
        actions: actions.map(action => ({
          type: action.type,
          timestamp: new Date(action.timestamp).toLocaleTimeString(),
          description: getActionDescription(action)
        }))
      }
    })

  } catch (error) {
    console.error('❌ 스크립트 생성 실패:', error)
    return NextResponse.json({
      success: false,
      error: '스크립트 생성에 실패했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

function getActionDescription(action: any): string {
  switch (action.type) {
    case 'click':
      return `클릭: ${action.textContent || action.tagName} (${action.selector})`
    case 'input':
      return `입력: ${action.value} → ${action.selector}`
    case 'keydown':
      return `키입력: ${action.key}`
    case 'navigation':
      return `페이지 이동: ${action.url}`
    default:
      return `${action.type}: ${JSON.stringify(action).slice(0, 50)}...`
  }
}