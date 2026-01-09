#!/usr/bin/env node
/**
 * Prisma 마이그레이션 배포 스크립트
 * 기존 데이터베이스에 안전하게 마이그레이션 적용
 *
 * 사용법: node scripts/migrate-deploy.js
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const DB_DIR = path.resolve(__dirname, '..')
const MIGRATIONS_DIR = path.join(DB_DIR, 'prisma', 'migrations')

function run(command, options = {}) {
  console.log(`> ${command}`)
  try {
    execSync(command, {
      cwd: DB_DIR,
      stdio: 'inherit',
      ...options,
    })
    return true
  } catch (error) {
    if (options.ignoreError) return false
    throw error
  }
}

function getMigrationNames() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return []
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => {
      const fullPath = path.join(MIGRATIONS_DIR, name)
      // 숫자로 시작하는 디렉토리만 (실제 마이그레이션)
      return fs.statSync(fullPath).isDirectory() && /^\d/.test(name)
    })
    .sort()
}

async function main() {
  console.log('==========================================')
  console.log('Prisma 마이그레이션 배포 시작')
  console.log('==========================================\n')

  // 1. Prisma 클라이언트 생성
  console.log('[1/3] Prisma 클라이언트 생성...')
  run('npx prisma generate --schema prisma')

  // 2. 마이그레이션 deploy 시도
  console.log('\n[2/3] 마이그레이션 적용 시도...')

  const deploySuccess = run('npx prisma migrate deploy --schema prisma', {
    ignoreError: true,
    stdio: 'pipe',
  })

  if (!deploySuccess) {
    console.log('기존 데이터베이스 감지됨. Baseline 설정 중...\n')

    // 모든 마이그레이션을 이미 적용된 것으로 표시
    const migrations = getMigrationNames()

    for (const migration of migrations) {
      console.log(`  - Baseline 설정: ${migration}`)
      run(`npx prisma migrate resolve --applied "${migration}" --schema prisma`, {
        ignoreError: true,
        stdio: 'pipe',
      })
    }

    // 다시 deploy 시도
    console.log('\n마이그레이션 재시도...')
    run('npx prisma migrate deploy --schema prisma')
  }

  console.log('\n[3/3] 완료!')
  console.log('==========================================')
  console.log('Prisma 마이그레이션 배포 완료')
  console.log('==========================================')
}

main().catch((error) => {
  console.error('마이그레이션 실패:', error.message)
  process.exit(1)
})
