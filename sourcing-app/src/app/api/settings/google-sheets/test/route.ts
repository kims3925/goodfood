export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { settingsService } from '@/modules/config/domain/src/settings'
import { google } from 'googleapis'

// POST: 구글 시트 연결 테스트
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
    const { serviceAccountJson, spreadsheetId } = body

    if (!serviceAccountJson || !spreadsheetId) {
      return NextResponse.json(
        { success: false, error: '서비스 계정 JSON과 스프레드시트 ID는 필수입니다.' },
        { status: 400 }
      )
    }

    // JSON 파싱
    let credentials
    try {
      credentials = JSON.parse(serviceAccountJson)
    } catch {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 JSON 형식입니다.' },
        { status: 400 }
      )
    }

    // 스프레드시트 ID 추출 (URL이 입력된 경우)
    let sheetId = spreadsheetId
    const urlMatch = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (urlMatch) {
      sheetId = urlMatch[1]
    }

    // Google Sheets API 인증
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // 스프레드시트 정보 가져오기 (연결 테스트)
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    })

    const spreadsheetTitle = response.data.properties?.title
    const sheetNames = response.data.sheets?.map(sheet => sheet.properties?.title) || []

    return NextResponse.json({
      success: true,
      data: {
        spreadsheetTitle,
        sheetNames,
        message: `"${spreadsheetTitle}" 스프레드시트에 연결되었습니다.`,
      }
    })
  } catch (error: any) {
    console.error('구글 시트 연결 테스트 실패:', error)

    // Google API 에러 처리
    if (error.code === 403) {
      return NextResponse.json(
        { success: false, error: '스프레드시트에 접근 권한이 없습니다. 서비스 계정 이메일을 시트에 공유해주세요.' },
        { status: 403 }
      )
    }

    if (error.code === 404) {
      return NextResponse.json(
        { success: false, error: '스프레드시트를 찾을 수 없습니다. ID를 확인해주세요.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: '구글 시트 연결에 실패했습니다. 설정을 확인해주세요.' },
      { status: 500 }
    )
  }
}
