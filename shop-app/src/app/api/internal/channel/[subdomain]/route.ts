import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  // 내부 API 키 검증
  const internalKey = req.headers.get('x-internal-key')
  const expectedKey = process.env.INTERNAL_API_KEY || 'dev-internal-key'

  if (internalKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { subdomain } = await params

  try {
    const channel = await prisma.channel.findFirst({
      where: {
        subdomain: subdomain,
        kind: 'RETAIL', // 소매 채널만
      },
      select: {
        id: true,
        subdomain: true,
        name: true,
        displayName: true,
        coverUrl: true,
        isActive: true,
        enableToss: true,
        enableBankTransfer: true,
        freeShippingAmount: true,
        defaultShippingFee: true,
        contactPhone: true,
        contactEmail: true,
        bankName: true,
        bankAccount: true,
        accountHolder: true,
      },
    })

    return NextResponse.json({ channel })
  } catch (error) {
    console.error('Failed to fetch channel by subdomain:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
