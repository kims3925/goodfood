/**
 * 카테고리 트리 시드 (B2B 공급몰 전환 STEP 1-2)
 *
 * 대분류(depth 1) = 기존 category.keywords.ts 의 평면 코드 8개 (SEA/AGR/MEA/MKT/PRC/HLT/COM/ETC)
 *   → Product.categoryId 기존 데이터와 코드가 일치해 무파괴.
 * 중분류(depth 2) = 식품 도매 기준 세분류. 코드는 `대분류_세분류` 형식.
 *
 * 실행 (db 폴더에서):
 *   node scripts/seed-categories.cjs
 *
 * upsert(code 기준) 라서 여러 번 실행해도 안전 (idempotent).
 * 기존 행의 name/sortOrder 는 갱신하지만 isActive/deletedAt 은 건드리지 않는다
 * (관리자가 비활성화한 카테고리를 시드 재실행이 되살리지 않도록).
 */

const fs = require('fs')
const path = require('path')

// db/.env 의 DATABASE_URL 로드 (이미 환경에 있으면 유지)
if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '..', '.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"#]*)"?\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  }
}

const { PrismaClient } = require('../src/generated')

const prisma = new PrismaClient()

// [code, name, children?: [code, name][]]
const TREE = [
  ['SEA', '수산물', [
    ['SEA_FISH', '어류'],
    ['SEA_CRUSTACEAN', '갑각류'],
    ['SEA_MOLLUSK', '연체류'],
    ['SEA_SHELL', '패류'],
    ['SEA_DRIED', '해조류/건어물'],
  ]],
  ['AGR', '농산물', [
    ['AGR_VEG', '채소'],
    ['AGR_FRUIT', '과일'],
    ['AGR_GRAIN', '쌀/잡곡'],
    ['AGR_MUSHROOM', '버섯'],
  ]],
  ['MEA', '축산물', [
    ['MEA_BEEF', '소고기'],
    ['MEA_PORK', '돼지고기'],
    ['MEA_POULTRY', '닭/오리/계란'],
  ]],
  ['MKT', '밀키트/반찬/간편식', [
    ['MKT_MEALKIT', '밀키트'],
    ['MKT_SIDEDISH', '반찬'],
    ['MKT_INSTANT', '즉석/간편식'],
  ]],
  ['PRC', '가공식품', [
    ['PRC_SAUCE', '소스/양념/장류'],
    ['PRC_OIL', '기름/꿀/잼'],
    ['PRC_SNACK', '과자/음료'],
    ['PRC_CANNED', '통조림/햄/어묵'],
  ]],
  ['HLT', '건강식품', [
    ['HLT_GINSENG', '홍삼/인삼'],
    ['HLT_NUTS', '견과류'],
    ['HLT_DRIEDFRUIT', '건과일'],
    ['HLT_SUPPLEMENT', '영양제'],
  ]],
  ['COM', '상시상품', []],
  ['ETC', '기타', []],
  // 분류 실패(신뢰도 낮음) 상품 보관용 — 관리자 화면 "분류 대기" 필터 (STEP 1-3)
  ['UNCLASSIFIED', '분류 대기', []],
]

async function upsertCategory({ code, name, parentId, depth, sortOrder }) {
  const existing = await prisma.category.findUnique({ where: { code } })
  if (existing) {
    return prisma.category.update({
      where: { code },
      data: { name, parentId, depth, sortOrder },
    })
  }
  return prisma.category.create({
    data: { code, name, parentId, depth, sortOrder },
  })
}

async function main() {
  let created = 0
  let updated = 0

  for (let i = 0; i < TREE.length; i++) {
    const [code, name, children] = TREE[i]
    const before = await prisma.category.findUnique({ where: { code } })
    const parent = await upsertCategory({ code, name, parentId: null, depth: 1, sortOrder: i * 10 })
    before ? updated++ : created++

    for (let j = 0; j < (children || []).length; j++) {
      const [childCode, childName] = children[j]
      const childBefore = await prisma.category.findUnique({ where: { code: childCode } })
      await upsertCategory({
        code: childCode,
        name: childName,
        parentId: parent.id,
        depth: 2,
        sortOrder: j * 10,
      })
      childBefore ? updated++ : created++
    }
  }

  console.log(`[seed-categories] 완료 — 생성 ${created}건, 갱신 ${updated}건`)
}

main()
  .catch((e) => {
    console.error('[seed-categories] 실패:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
