export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export async function GET() {
  const timestamp = new Date().toISOString()
  let dbStatus: 'ok' | 'error' = 'error'

  // DB 체크
  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = 'ok'
  } catch {
    dbStatus = 'error'
  }

  const isHealthy = dbStatus === 'ok'
  const status = isHealthy ? 'healthy' : 'unhealthy'

  return NextResponse.json(
    {
      status,
      timestamp,
      db: dbStatus,
      version: process.env.npm_package_version || '1.0.0',
    },
    { status: isHealthy ? 200 : 503 }
  )
}
