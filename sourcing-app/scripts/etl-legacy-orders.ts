/**
 * 5년치 좋은친구도매방 주문장 (xlsx) → LegacyOrder 테이블 ETL.
 *
 * 참조: BandAuto_데이터활용_1일3회공지_개발계획서_v2.docx §4.2
 *
 * 사용법:
 *   npx tsx scripts/etl-legacy-orders.ts
 *   npx tsx scripts/etl-legacy-orders.ts --folder=path/to/xlsx --dry-run
 *   npx tsx scripts/etl-legacy-orders.ts --file=path/to/single.xlsx
 *
 * 동작:
 *   1) 폴더 내 .xlsx 파일을 모두 읽음 (기본: C:/Users/kims3/SNS_AUTO/기존주문데이터)
 *   2) 각 시트마다 시트명 → 날짜 변환 (YYMMDD / MMDD(요일) 자동 분기)
 *   3) 데이터 행에서 구분/상품명/수량/판매가/정산가/수익/받는분 추출
 *   4) 받는분은 SHA-256 해시 (PII), 주소에서 시/도 추출
 *   5) (orderDate, rowIndex, channelName) 유니크 키로 createMany skipDuplicates 배치 적재
 *
 * 멱등성: 같은 스크립트를 여러 번 돌려도 중복 적재되지 않음.
 *         재실행 시 새로 추가된 행만 들어감.
 */

import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import * as xlsx from 'xlsx'
import prisma from '@bandauto/db'

// ─── CLI 파싱 ───────────────────────────────────────────
const DEFAULT_FOLDER = 'C:/Users/kims3/SNS_AUTO/기존주문데이터'

const args = process.argv.slice(2)
const argMap: Record<string, string> = {}
for (const a of args) {
  const m = a.match(/^--([\w-]+)(?:=(.+))?$/)
  if (m) argMap[m[1]] = m[2] ?? 'true'
}
const folder = argMap['folder'] || DEFAULT_FOLDER
const singleFile = argMap['file'] || null
const dryRun = argMap['dry-run'] === 'true'
const batchSize = parseInt(argMap['batch'] || '500', 10)

// ─── 시트명 → 날짜 ────────────────────────────────────
interface DateCtx {
  lastYear: number
  lastMonth: number | null
}

function parseSheetDate(sheetName: string, ctx: DateCtx): Date | null {
  // YYMMDD (예: 230118 / 250908)
  const m1 = sheetName.match(/^(\d{2})(\d{2})(\d{2})$/)
  if (m1) {
    const yy = parseInt(m1[1], 10)
    const mm = parseInt(m1[2], 10)
    const dd = parseInt(m1[3], 10)
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
    const year = 2000 + yy
    ctx.lastYear = year
    ctx.lastMonth = mm
    return new Date(Date.UTC(year, mm - 1, dd))
  }
  // MMDD or MMDD(요일) (예: 0701(목) / 1221)
  const m2 = sheetName.match(/^(\d{2})(\d{2})(?:\(.\))?$/)
  if (m2) {
    const mm = parseInt(m2[1], 10)
    const dd = parseInt(m2[2], 10)
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
    let year = ctx.lastYear
    // 월이 이전 시트보다 크게 감소(예: 12 → 1)하면 새 해로 롤오버
    if (ctx.lastMonth !== null && mm < ctx.lastMonth && (ctx.lastMonth - mm) >= 6) {
      year = ctx.lastYear + 1
      ctx.lastYear = year
    }
    ctx.lastMonth = mm
    return new Date(Date.UTC(year, mm - 1, dd))
  }
  return null
}

// ─── 헤더 행 탐지 ────────────────────────────────────
function findHeaderRow(rows: any[][]): { headerRow: number; cols: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i] || []
    const map: Record<string, number> = {}
    for (let c = 0; c < r.length; c++) {
      const v = String(r[c] ?? '').trim()
      if (!v) continue
      if (v === 'NO') map.no = c
      else if (v === '구분') map.channel = c
      else if (v === '상품명') map.product = c
      else if (v === '수량') map.quantity = c
      else if (v === '받는분') map.buyer = c
      else if (v === '주소') map.address = c
      else if (v === '판매가') map.salePrice = c
      else if (v === '정산가') map.costPrice = c
      else if (v === '수익') map.profit = c
    }
    // 필수: 구분 / 상품명 / 판매가
    if (map.channel !== undefined && map.product !== undefined && map.salePrice !== undefined) {
      return { headerRow: i, cols: map }
    }
  }
  return null
}

// ─── 값 파싱 헬퍼 ────────────────────────────────────
function toInt(v: any): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Math.floor(v)
  const s = String(v).replace(/[,원\s\\￦₩]/g, '')
  const m = s.match(/-?\d+/)
  return m ? parseInt(m[0], 10) : 0
}

function toQty(v: any): number {
  if (v === null || v === undefined || v === '') return 1
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(1, Math.floor(v))
  // 문자열이면 첫 숫자 추출, 없으면 1
  const m = String(v).match(/\d+/)
  return m ? Math.max(1, parseInt(m[0], 10)) : 1
}

function trimStr(v: any, max = 500): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/\s+/g, ' ').trim().slice(0, max)
}

function sha256(v: any): string | null {
  if (!v) return null
  const s = String(v).trim()
  if (!s) return null
  return crypto.createHash('sha256').update(s).digest('hex')
}

// 주소 → 시/도 추출 (간단 매칭)
const REGION_HEADS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]
function extractRegion(addr: any): string | null {
  if (!addr) return null
  const s = String(addr).trim()
  for (const r of REGION_HEADS) {
    if (s.startsWith(r) || s.includes(` ${r}`) || s.includes(`${r}도`) || s.includes(`${r}특별시`) || s.includes(`${r}광역시`)) {
      return r
    }
  }
  return null
}

// ─── 메인 처리 ────────────────────────────────────────
interface BatchRow {
  orderDate: Date
  channelName: string
  productName: string
  quantity: number
  salePrice: number
  costPrice: number
  profit: number
  buyerHash: string | null
  regionCode: string | null
  rawSheetName: string
  sourceFile: string
  rowIndex: number
}

async function flushBatch(batch: BatchRow[]): Promise<number> {
  if (batch.length === 0) return 0
  if (dryRun) return batch.length
  const res = await prisma.legacyOrder.createMany({
    data: batch,
    skipDuplicates: true,
  })
  return res.count
}

async function processFile(filePath: string): Promise<{ rowsRead: number; rowsInserted: number; rowsSkipped: number }> {
  const baseName = path.basename(filePath)
  console.log(`\n📂 ${baseName}`)
  const wb = xlsx.readFile(filePath)
  console.log(`  시트 수: ${wb.SheetNames.length}`)

  // 파일명에서 시작 연도 힌트 추출
  const fnYearMatch = baseName.match(/-(\d{2})년/) || baseName.match(/-(\d{2})\d{4}\.xlsx$/)
  const ctx: DateCtx = {
    lastYear: fnYearMatch ? 2000 + parseInt(fnYearMatch[1], 10) - (baseName.includes('년주문장') ? 1 : 0) : 2021,
    lastMonth: null,
  }
  // 21년/22년 파일은 보통 2021-07 부터 시작하니까 lastYear=2021 로 고정
  if (baseName.startsWith('좋은친구도매방-21년') || baseName.startsWith('좋은친구도매방-22년')) {
    ctx.lastYear = 2021
  } else if (baseName.startsWith('좋은친구도매방-주문장-23')) {
    ctx.lastYear = 2021
  } else if (baseName.startsWith('좋은친구도매방-주문장-24')) {
    ctx.lastYear = 2021
  } else if (baseName.startsWith('좋은친구도매방-주문장-25')) {
    ctx.lastYear = 2025
  }

  let rowsRead = 0
  let rowsInserted = 0
  let rowsSkipped = 0
  let batch: BatchRow[] = []

  for (const sheetName of wb.SheetNames) {
    const date = parseSheetDate(sheetName, ctx)
    if (!date) {
      console.log(`  ⏭  시트 "${sheetName}" 날짜 파싱 실패 — 스킵`)
      continue
    }
    const ws = wb.Sheets[sheetName]
    const rows = xlsx.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      blankrows: false,
    }) as any[][]

    const hdr = findHeaderRow(rows)
    if (!hdr) {
      rowsSkipped += rows.length
      continue
    }

    const startRow = hdr.headerRow + 1
    let rowIdx = 0
    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r] || []
      const channelName = trimStr(row[hdr.cols.channel], 50)
      const productName = trimStr(row[hdr.cols.product], 500)
      const salePrice = toInt(row[hdr.cols.salePrice])

      // 필수 검증: 구분/상품명/판매가 셋 중 하나라도 빈 행은 스킵
      if (!channelName || !productName || salePrice <= 0) {
        rowsSkipped++
        continue
      }

      rowIdx++
      rowsRead++

      const costPrice = hdr.cols.costPrice !== undefined ? toInt(row[hdr.cols.costPrice]) : 0
      const profit = hdr.cols.profit !== undefined ? toInt(row[hdr.cols.profit]) : Math.max(0, salePrice - costPrice)

      batch.push({
        orderDate: date,
        channelName,
        productName,
        quantity: hdr.cols.quantity !== undefined ? toQty(row[hdr.cols.quantity]) : 1,
        salePrice,
        costPrice,
        profit,
        buyerHash: hdr.cols.buyer !== undefined ? sha256(row[hdr.cols.buyer]) : null,
        regionCode: hdr.cols.address !== undefined ? extractRegion(row[hdr.cols.address]) : null,
        rawSheetName: sheetName,
        sourceFile: baseName,
        rowIndex: rowIdx,
      })

      if (batch.length >= batchSize) {
        rowsInserted += await flushBatch(batch)
        batch = []
      }
    }
  }

  if (batch.length > 0) {
    rowsInserted += await flushBatch(batch)
  }

  console.log(`  📥 읽음: ${rowsRead} · 적재: ${rowsInserted}${dryRun ? ' (dry-run)' : ''} · 스킵: ${rowsSkipped}`)
  return { rowsRead, rowsInserted, rowsSkipped }
}

async function main() {
  const t0 = Date.now()
  console.log('=== LegacyOrder ETL ===')
  console.log(`folder: ${folder}`)
  console.log(`dry-run: ${dryRun}`)
  console.log(`batch size: ${batchSize}`)

  const files: string[] = []
  if (singleFile) {
    files.push(path.isAbsolute(singleFile) ? singleFile : path.join(folder, singleFile))
  } else {
    if (!fs.existsSync(folder)) {
      console.error(`❌ 폴더 없음: ${folder}`)
      process.exit(1)
    }
    for (const name of fs.readdirSync(folder)) {
      if (name.toLowerCase().endsWith('.xlsx') && !name.startsWith('~$')) {
        files.push(path.join(folder, name))
      }
    }
  }

  if (files.length === 0) {
    console.log('처리할 파일 없음')
    return
  }

  console.log(`처리할 파일 ${files.length}개\n`)
  let totalRead = 0, totalInserted = 0, totalSkipped = 0
  for (const fp of files) {
    const r = await processFile(fp)
    totalRead += r.rowsRead
    totalInserted += r.rowsInserted
    totalSkipped += r.rowsSkipped
  }

  // 최종 통계
  if (!dryRun) {
    const totalInDb = await prisma.legacyOrder.count()
    const oldest = await prisma.legacyOrder.findFirst({ orderBy: { orderDate: 'asc' }, select: { orderDate: true } })
    const newest = await prisma.legacyOrder.findFirst({ orderBy: { orderDate: 'desc' }, select: { orderDate: true } })
    console.log(`\n=== 완료 ===`)
    console.log(`총 읽음: ${totalRead} · 신규 적재: ${totalInserted} · 스킵: ${totalSkipped}`)
    console.log(`DB total: ${totalInDb}`)
    if (oldest && newest) {
      console.log(`기간: ${oldest.orderDate.toISOString().slice(0, 10)} ~ ${newest.orderDate.toISOString().slice(0, 10)}`)
    }
  } else {
    console.log(`\n=== dry-run 완료 ===`)
    console.log(`읽음: ${totalRead} · 적재 예상: ${totalInserted} · 스킵: ${totalSkipped}`)
  }

  console.log(`소요: ${((Date.now() - t0) / 1000).toFixed(1)}초`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ ETL 실패:', err)
    process.exit(1)
  })
