/**
 * 기존 평문 밴드 세션 쿠키 일괄 암호화 (SaaS P0-3, 2026-06-11)
 *
 * channel.band_session_cookie 중 'enc:v1:' prefix 가 없는(평문) 행을
 * AES-256-GCM 으로 암호화한다. 알고리즘/형식은
 * sourcing-app/src/lib/band-cookie-crypto.ts 와 동일.
 *
 * 실행 (db 폴더에서):
 *   node scripts/encrypt-session-cookies.cjs            # 실제 적용
 *   node scripts/encrypt-session-cookies.cjs --dry-run  # 대상 카운트만
 *
 * 키: env BAND_COOKIE_ENC_KEY (없으면 ../sourcing-app/.env 에서 로드)
 * idempotent — 이미 암호화된 행은 건너뜀.
 */

const fs = require('fs')
const path = require('path')
const { createCipheriv, randomBytes } = require('crypto')

// env 로드: DATABASE_URL ← db/.env, BAND_COOKIE_ENC_KEY ← sourcing-app/.env
function loadEnvFile(p) {
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"#]*)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
loadEnvFile(path.join(__dirname, '..', '.env'))
loadEnvFile(path.join(__dirname, '..', '..', 'sourcing-app', '.env'))

const PREFIX = 'enc:v1:'
const keyHex = process.env.BAND_COOKIE_ENC_KEY
if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
  console.error('[encrypt-session-cookies] BAND_COOKIE_ENC_KEY 미설정/형식 오류 (64자 hex) — 중단')
  process.exit(1)
}
const key = Buffer.from(keyHex, 'hex')

function encrypt(plain) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

const { PrismaClient } = require('../src/generated')
const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const channels = await prisma.channel.findMany({
    where: { bandSessionCookie: { not: null } },
    select: { id: true, name: true, bandSessionCookie: true },
  })

  const targets = channels.filter((c) => c.bandSessionCookie && !c.bandSessionCookie.startsWith(PREFIX))
  console.log(`[encrypt-session-cookies] 쿠키 보유 채널 ${channels.length}개 중 평문 ${targets.length}개`)

  if (dryRun) {
    for (const c of targets) console.log(`  - [${c.id}] ${c.name} (길이 ${c.bandSessionCookie.length})`)
    console.log('[encrypt-session-cookies] dry-run — 변경 없음')
    return
  }

  let done = 0
  for (const c of targets) {
    await prisma.channel.update({
      where: { id: c.id },
      data: { bandSessionCookie: encrypt(c.bandSessionCookie) },
    })
    done++
  }
  console.log(`[encrypt-session-cookies] 완료 — ${done}개 채널 암호화`)
}

main()
  .catch((e) => {
    console.error('[encrypt-session-cookies] 실패:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
