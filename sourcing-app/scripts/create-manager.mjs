import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env') })

const { PrismaClient } = await import('../../db/src/generated/index.js')
const prisma = new PrismaClient()

const EMAIL = 'terror8710@naver.com'
const PASSWORD = 'Manager@2026!'
const NAME = '경영매니저'

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } })
  if (existing) {
    console.log(`이미 존재하는 사용자: id=${existing.id}, email=${existing.email}, role=${existing.role}, deletedAt=${existing.deletedAt}`)
    if (existing.role !== 'MANAGER' || existing.deletedAt) {
      const hashed = await bcrypt.hash(PASSWORD, 10)
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'MANAGER',
          deletedAt: null,
          password: hashed,
          name: existing.name ?? NAME,
        },
      })
      console.log(`기존 사용자 MANAGER 로 갱신 및 비밀번호 재설정: id=${updated.id}`)
    } else {
      console.log('이미 MANAGER 역할이며 활성 상태입니다. 비밀번호만 재설정합니다.')
      const hashed = await bcrypt.hash(PASSWORD, 10)
      await prisma.user.update({ where: { id: existing.id }, data: { password: hashed } })
      console.log('비밀번호 재설정 완료')
    }
  } else {
    const hashed = await bcrypt.hash(PASSWORD, 10)
    const created = await prisma.user.create({
      data: {
        email: EMAIL,
        password: hashed,
        name: NAME,
        role: 'MANAGER',
        signupCompletedAt: new Date(),
        mode: 'pro',
      },
    })
    console.log(`신규 매니저 생성 완료: id=${created.id}, email=${created.email}, role=${created.role}`)
  }
}

main()
  .catch((e) => {
    console.error('실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
