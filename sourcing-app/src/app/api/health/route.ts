export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getRedisClient } from '@/lib/redis'

export async function GET() {
  const timestamp = new Date().toISOString()
  let dbStatus: 'ok' | 'error' = 'error'
  let redisStatus: 'ok' | 'error' | 'unavailable' = 'error'

  // DB 체크
  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = 'ok'
  } catch {
    dbStatus = 'error'
  }

  // Redis 체크
  try {
    const client = await getRedisClient()
    if (client) {
      await client.ping()
      redisStatus = 'ok'
    } else {
      redisStatus = 'unavailable'
    }
  } catch {
    redisStatus = 'error'
  }

  const isHealthy = dbStatus === 'ok'
  const status = isHealthy ? 'healthy' : 'unhealthy'

  return NextResponse.json(
    {
      status,
      timestamp,
      db: dbStatus,
      redis: redisStatus,
      version: process.env.npm_package_version || '1.0.0',
    },
    { status: isHealthy ? 200 : 503 }
  )
}
