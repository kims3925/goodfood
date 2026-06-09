import { google, sheets_v4 } from 'googleapis'
import { settingsService } from '@/modules/config/domain/src/settings'

// 엑셀 행 데이터 타입 (기존 export와 동일)
export interface SheetRowData {
  orderNumber: string
  shopName: string
  timestamp: string
  productName: string
  quantity: number
  productAmount: number
  shippingFee: number
  totalAmount: number
  recipientName: string
  recipientPhone: string
  fullAddress: string
  senderName: string
  cashReceipt: string
  email: string
  dateKey: string
  isShipped: boolean
}

export class GoogleSheetsService {
  private async getAuthClient(serviceAccountJson: string) {
    const credentials = JSON.parse(serviceAccountJson)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    return auth
  }

  private async getSheetsClient(serviceAccountJson: string): Promise<sheets_v4.Sheets> {
    const auth = await this.getAuthClient(serviceAccountJson)
    return google.sheets({ version: 'v4', auth })
  }

  /**
   * 구글 시트에 발주서 데이터 동기화
   */
  async syncOrdersToSheet(
    userId: number,
    channelName: string,
    rows: SheetRowData[]
  ): Promise<{ success: boolean; message: string; url?: string }> {
    // 사용자의 구글 시트 설정 조회
    const serviceAccountJson = await settingsService.getGoogleSheetServiceAccount(userId)
    if (!serviceAccountJson) {
      throw new Error('구글 시트 설정이 없습니다. 설정 페이지에서 먼저 설정해주세요.')
    }

    const settings = await settingsService.getGoogleSheetSettings(userId)
    if (!settings) {
      throw new Error('구글 시트 설정이 없습니다.')
    }

    const sheets = await this.getSheetsClient(serviceAccountJson)
    const spreadsheetId = settings.spreadsheetId

    // 시트 이름 결정 (설정된 이름 또는 도매처명)
    const sheetName = settings.sheetName || channelName

    // 기존 시트 확인 또는 생성
    await this.ensureSheetExists(sheets, spreadsheetId, sheetName)

    // 시트 초기화 및 데이터 작성
    await this.writeDataToSheet(sheets, spreadsheetId, sheetName, channelName, rows)

    // 마지막 동기화 시간 업데이트
    await settingsService.updateGoogleSheetLastSynced(userId)

    return {
      success: true,
      message: `${rows.length}건의 주문이 구글 시트에 동기화되었습니다.`,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    }
  }

  // 단건 append 전용 헤더 (A:N 14열) — syncOrdersToSheet 의 날짜그룹 포맷과 별개의 평면 누적 시트.
  private static readonly APPEND_HEADER = [
    '주문번호', '쇼핑몰', '주문일시', '상품명', '수량', '판매가', '배송비', '합계',
    '받는분', '연락처', '주소', '보내는분', '비고', '이메일',
  ]

  /**
   * 주문 1건의 행들을 시트에 "추가"(append)한다 — 기존 데이터를 지우지 않는다.
   * syncOrdersToSheet(전체 덮어쓰기)와 달리, 주문 상세에서 버튼 1클릭으로 누적 기록하는 용도.
   * 전용 탭(기본 '쇼핑몰주문')을 사용해 도매발주 동기화(전체 clear)와 충돌하지 않게 한다.
   */
  async appendOrderRows(
    userId: number,
    rows: SheetRowData[],
    sheetTabName: string = '쇼핑몰주문'
  ): Promise<{ success: boolean; message: string; url?: string; appended: number }> {
    const serviceAccountJson = await settingsService.getGoogleSheetServiceAccount(userId)
    if (!serviceAccountJson) {
      throw new Error('구글 시트 설정이 없습니다. 설정 페이지에서 먼저 설정해주세요.')
    }
    const settings = await settingsService.getGoogleSheetSettings(userId)
    if (!settings) {
      throw new Error('구글 시트 설정이 없습니다.')
    }

    const sheets = await this.getSheetsClient(serviceAccountJson)
    const spreadsheetId = settings.spreadsheetId

    // 탭 보장
    await this.ensureSheetExists(sheets, spreadsheetId, sheetTabName)

    // 헤더 존재 여부 확인 (A1 비어있으면 헤더 먼저 기록)
    const head = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTabName}!A1:N1`,
    })
    const hasHeader = Array.isArray(head.data.values) && head.data.values.length > 0
    if (!hasHeader) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [GoogleSheetsService.APPEND_HEADER] },
      })
    }

    // 데이터 행 구성 후 append
    const values = rows.map((r) => [
      r.orderNumber, r.shopName, r.timestamp, r.productName, r.quantity,
      r.productAmount, r.shippingFee, r.totalAmount, r.recipientName, r.recipientPhone,
      r.fullAddress, r.senderName, r.cashReceipt, r.email,
    ])
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetTabName}!A:N`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    })

    await settingsService.updateGoogleSheetLastSynced(userId)

    return {
      success: true,
      message: `${rows.length}건의 항목이 구글 시트('${sheetTabName}')에 추가되었습니다.`,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      appended: rows.length,
    }
  }

  /**
   * 시트 존재 여부 확인 및 생성
   */
  private async ensureSheetExists(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetName: string
  ): Promise<void> {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
    const existingSheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === sheetName
    )

    if (!existingSheet) {
      // 새 시트 생성
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: sheetName },
              },
            },
          ],
        },
      })
    }
  }

  /**
   * 시트에 데이터 작성
   */
  private async writeDataToSheet(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetName: string,
    channelName: string,
    rows: SheetRowData[]
  ): Promise<void> {
    // 시트 초기화 (기존 데이터 삭제)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A:N`,
    })

    // 날짜별로 그룹화
    const groupedByDate = new Map<string, SheetRowData[]>()
    for (const row of rows) {
      const existing = groupedByDate.get(row.dateKey) || []
      existing.push(row)
      groupedByDate.set(row.dateKey, existing)
    }

    // 날짜 키를 내림차순 정렬
    const sortedDateKeys = Array.from(groupedByDate.keys()).sort((a, b) => b.localeCompare(a))

    // 데이터 준비 및 행 위치 추적
    const values: (string | number)[][] = []
    const dateRowIndices: number[] = []      // 날짜 구분선 행
    const headerRowIndices: number[] = []    // 헤더 행
    const subtotalRowIndices: number[] = []  // 소계 행
    const shippedRowIndices: number[] = []   // 발주 완료 행
    const dataRowIndices: number[] = []      // 일반 데이터 행
    let totalRowIndex = 0                    // 총합계 행

    // 타이틀
    values.push(['도매 발주견적서'])
    values.push([`도매처: ${channelName}`])
    values.push([`생성일시: ${new Date().toLocaleString('ko-KR')}`])
    values.push([`총 주문: ${rows.length}건`])
    values.push([`총 발주일수: ${sortedDateKeys.length}일`])
    values.push([]) // 빈 줄

    let grandTotalQty = 0
    let grandTotalProductAmount = 0
    let grandTotalShippingFee = 0
    let grandTotalAmount = 0

    // 날짜별 그룹 출력
    for (const dateKey of sortedDateKeys) {
      const dateRows = groupedByDate.get(dateKey) || []

      // 요일 계산
      const date = new Date(dateKey)
      const dayNames = ['일', '월', '화', '수', '목', '금', '토']
      const dayName = dayNames[date.getDay()]

      // 날짜 구분선
      dateRowIndices.push(values.length)
      values.push([`▼ ${dateKey} (${dayName}) - ${dateRows.length}건`])

      // 테이블 헤더
      headerRowIndices.push(values.length)
      values.push([
        '주문번호', '출처(소매처)', '타임스탬프', '상품및 제품명', '수량',
        '상품금액', '배송비', '합계', '배송받는분 이름', '받는분 연락처',
        '배송지 주소', '보내는사람', '현금영수증', '이메일주소'
      ])

      // 해당 날짜의 데이터
      let dateTotalQty = 0
      let dateTotalProductAmount = 0
      let dateTotalShippingFee = 0
      let dateTotalAmount = 0

      for (const rowData of dateRows) {
        dateTotalQty += rowData.quantity
        dateTotalProductAmount += rowData.productAmount
        dateTotalShippingFee += rowData.shippingFee
        dateTotalAmount += rowData.totalAmount
        grandTotalQty += rowData.quantity
        grandTotalProductAmount += rowData.productAmount
        grandTotalShippingFee += rowData.shippingFee
        grandTotalAmount += rowData.totalAmount

        // 데이터 행 추적
        const currentRowIndex = values.length
        dataRowIndices.push(currentRowIndex)

        // 발주 완료 행 추적
        if (rowData.isShipped) {
          shippedRowIndices.push(currentRowIndex)
        }

        values.push([
          rowData.orderNumber,
          rowData.shopName,
          rowData.timestamp,
          rowData.productName,
          rowData.quantity,
          rowData.productAmount,
          rowData.shippingFee,
          rowData.totalAmount,
          rowData.recipientName,
          rowData.recipientPhone,
          rowData.fullAddress,
          rowData.senderName,
          rowData.cashReceipt,
          rowData.email,
        ])
      }

      // 일별 소계
      subtotalRowIndices.push(values.length)
      values.push([
        `소계 (${dateKey})`, '', '', '',
        dateTotalQty, dateTotalProductAmount, dateTotalShippingFee, dateTotalAmount,
        '', '', '', '', '', ''
      ])
      values.push([]) // 빈 줄
    }

    // 총합계
    totalRowIndex = values.length
    values.push([
      '총합계', '', '', '',
      grandTotalQty, grandTotalProductAmount, grandTotalShippingFee, grandTotalAmount,
      '', '', '', '', '', ''
    ])

    // 시트에 데이터 쓰기
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    })

    // 열 너비 및 서식 설정
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName)
    const sheetId = sheet?.properties?.sheetId

    if (sheetId != null) {
      await this.applyFormatting(sheets, spreadsheetId, sheetId, {
        totalRows: values.length,
        dateRowIndices,
        headerRowIndices,
        subtotalRowIndices,
        shippedRowIndices,
        dataRowIndices,
        totalRowIndex,
      })
    }
  }

  /**
   * 시트 서식 적용 (엑셀과 동일한 스타일)
   */
  private async applyFormatting(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetId: number,
    formatInfo: {
      totalRows: number
      dateRowIndices: number[]
      headerRowIndices: number[]
      subtotalRowIndices: number[]
      shippedRowIndices: number[]
      dataRowIndices: number[]
      totalRowIndex: number
    }
  ): Promise<void> {
    const { totalRows, dateRowIndices, headerRowIndices, subtotalRowIndices, shippedRowIndices, dataRowIndices, totalRowIndex } = formatInfo

    // 테두리 스타일
    const thinBorder = {
      style: 'SOLID' as const,
      color: { red: 0, green: 0, blue: 0 },
    }
    const borders = {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
    }

    const requests: sheets_v4.Schema$Request[] = [
      // 전체 시트 글꼴 설정 (Calibri - 엑셀 기본 글꼴)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: totalRows + 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: {
            userEnteredFormat: {
              textFormat: { fontFamily: 'Calibri' },
            },
          },
          fields: 'userEnteredFormat.textFormat.fontFamily',
        },
      },

      // 열 너비 설정 (엑셀과 동일)
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 135 }, fields: 'pixelSize' } },   // 주문번호
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 115 }, fields: 'pixelSize' } },   // 출처
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 135 }, fields: 'pixelSize' } },   // 타임스탬프
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 300 }, fields: 'pixelSize' } },   // 상품명
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 60 }, fields: 'pixelSize' } },    // 수량
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 }, properties: { pixelSize: 90 }, fields: 'pixelSize' } },    // 상품금액
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 }, properties: { pixelSize: 75 }, fields: 'pixelSize' } },    // 배송비
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 }, properties: { pixelSize: 90 }, fields: 'pixelSize' } },    // 합계
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 }, properties: { pixelSize: 90 }, fields: 'pixelSize' } },    // 받는분
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 9, endIndex: 10 }, properties: { pixelSize: 115 }, fields: 'pixelSize' } },  // 연락처
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 10, endIndex: 11 }, properties: { pixelSize: 375 }, fields: 'pixelSize' } }, // 주소
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 11, endIndex: 12 }, properties: { pixelSize: 90 }, fields: 'pixelSize' } },  // 보내는사람
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 12, endIndex: 13 }, properties: { pixelSize: 150 }, fields: 'pixelSize' } }, // 현금영수증
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 13, endIndex: 14 }, properties: { pixelSize: 190 }, fields: 'pixelSize' } }, // 이메일

      // 타이틀 셀 병합
      {
        mergeCells: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 14 },
          mergeType: 'MERGE_ALL',
        },
      },
      // 타이틀 스타일 (엑셀: bold 16pt, 가운데 정렬, 배경색 없음)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 16 },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
        },
      },
      // 타이틀 정보 영역 (도매처, 생성일시, 총 주문, 총 발주일수 - 12pt)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 14 },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 12 },
            },
          },
          fields: 'userEnteredFormat.textFormat.fontSize',
        },
      },

      // 숫자 형식 (천단위 콤마)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 6, endRowIndex: totalRows + 1, startColumnIndex: 4, endColumnIndex: 8 },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'NUMBER', pattern: '#,##0' },
            },
          },
          fields: 'userEnteredFormat.numberFormat',
        },
      },
    ]

    // 날짜 구분선 서식 (엑셀: #4472C4 파란색 배경, 흰색 굵은 글씨 12pt)
    for (const rowIndex of dateRowIndices) {
      // 셀 병합
      requests.push({
        mergeCells: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 14 },
          mergeType: 'MERGE_ALL',
        },
      })
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.27, green: 0.45, blue: 0.77 },  // #4472C4
              textFormat: { bold: true, fontSize: 12, foregroundColor: { red: 1, green: 1, blue: 1 } },
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.verticalAlignment',
        },
      })
    }

    // 헤더 서식 (엑셀: #E0E0E0 회색 배경, 굵은 글씨 11pt, 가운데 정렬, 테두리)
    for (const rowIndex of headerRowIndices) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.88, green: 0.88, blue: 0.88 },  // #E0E0E0
              textFormat: { bold: true, fontSize: 11 },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              borders,
            },
          },
          fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment,userEnteredFormat.borders',
        },
      })
    }

    // 데이터 행 서식 (11pt, 테두리)
    for (const rowIndex of dataRowIndices) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 11 },
              borders,
            },
          },
          fields: 'userEnteredFormat.textFormat.fontSize,userEnteredFormat.borders',
        },
      })
    }

    // 발주 완료 행 서식 (엑셀: #D0D0D0 진한 회색 배경, 11pt, 테두리, 취소선 없음)
    for (const rowIndex of shippedRowIndices) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.82, green: 0.82, blue: 0.82 },  // #D0D0D0
              textFormat: { fontSize: 11, strikethrough: false },
              borders,
            },
          },
          fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.borders',
        },
      })
    }

    // 소계 서식 (엑셀: #D9E1F2 연파란색 배경, 굵은 글씨, 테두리)
    for (const rowIndex of subtotalRowIndices) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.85, green: 0.88, blue: 0.95 },  // #D9E1F2
              textFormat: { bold: true },
              borders,
            },
          },
          fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.borders',
        },
      })
    }

    // 총합계 서식 (엑셀: #FFF0C0 연노란색 배경, 굵은 글씨 12pt, 테두리)
    if (totalRowIndex > 0) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 1, green: 0.94, blue: 0.75 },  // #FFF0C0
              textFormat: { bold: true, fontSize: 12 },
              borders,
            },
          },
          fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.borders',
        },
      })
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    })
  }

  /**
   * 연결 테스트
   */
  async testConnection(
    serviceAccountJson: string,
    spreadsheetId: string
  ): Promise<{ success: boolean; spreadsheetTitle: string; sheetNames: string[] }> {
    const sheets = await this.getSheetsClient(serviceAccountJson)

    // URL에서 ID 추출
    let sheetId = spreadsheetId
    const urlMatch = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (urlMatch) {
      sheetId = urlMatch[1]
    }

    const response = await sheets.spreadsheets.get({ spreadsheetId: sheetId })

    return {
      success: true,
      spreadsheetTitle: response.data.properties?.title || '',
      sheetNames: response.data.sheets?.map(s => s.properties?.title || '') || [],
    }
  }
}

export const googleSheetsService = new GoogleSheetsService()
