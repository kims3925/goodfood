import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  try {
    console.log('🔍 Testing database connection...')
    
    // 간단한 데이터베이스 연결 테스트
    const userCount = await prisma.user.count()
    
    console.log(`✅ Database connected successfully. User count: ${userCount}`)
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      userCount,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}