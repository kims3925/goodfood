import { NextRequest, NextResponse } from 'next/server'

/**
 * 간단한 타임스탬프 테스트 API
 * GET /api/test/band/simple-timestamp-test
 */
export async function GET(request: NextRequest) {
  try {
    // 현재 시간 정보
    const now = new Date()
    const todayKST = '2025-08-23'
    
    console.log('오늘 날짜:', todayKST)
    console.log('현재 timestamp (밀리초):', Date.now())
    console.log('현재 timestamp (초):', Math.floor(Date.now() / 1000))
    
    // 디버깅 데이터에서 확인한 타임스탬프 테스트
    const sampleTimestamp = 1755939329000 // 첫 번째 게시물 타임스탬프
    
    console.log('샘플 타임스탬프:', sampleTimestamp)
    console.log('타임스탬프 길이:', sampleTimestamp.toString().length)
    
    // 여러 해석 방법 테스트
    const tests = {
      as_milliseconds: new Date(sampleTimestamp),
      as_seconds: new Date(sampleTimestamp * 1000),
      divide_by_1000: new Date(sampleTimestamp / 1000)
    }
    
    const results = {}
    Object.entries(tests).forEach(([method, date]) => {
      results[method] = {
        date: date,
        iso_string: date.toISOString(),
        year: date.getFullYear(),
        is_reasonable: date.getFullYear() >= 2020 && date.getFullYear() <= 2030
      }
    })
    
    // 올바른 방법 찾기 (합리적인 연도를 가진 것)
    const correctMethod = Object.entries(results).find(([method, data]) => data.is_reasonable)
    
    if (correctMethod) {
      const [methodName, data] = correctMethod
      console.log('올바른 해석 방법:', methodName)
      console.log('올바른 날짜:', data.iso_string)
      
      // KST 변환
      const kstDate = new Date(data.date.getTime() + (9 * 60 * 60 * 1000))
      const kstDateString = kstDate.toISOString().split('T')[0]
      
      console.log('KST 날짜:', kstDateString)
      console.log('오늘과 같은가?', kstDateString === todayKST)
    }

    return NextResponse.json({
      success: true,
      current_info: {
        today_kst: todayKST,
        current_timestamp_ms: Date.now(),
        current_timestamp_s: Math.floor(Date.now() / 1000)
      },
      sample_timestamp: sampleTimestamp,
      timestamp_length: sampleTimestamp.toString().length,
      interpretation_tests: results,
      correct_method: correctMethod ? {
        method: correctMethod[0],
        date: correctMethod[1].iso_string,
        kst_date: new Date(correctMethod[1].date.getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0],
        is_today: new Date(correctMethod[1].date.getTime() + (9 * 60 * 60 * 1000)).toISOString().split('T')[0] === todayKST
      } : null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('타임스탬프 테스트 실패:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}