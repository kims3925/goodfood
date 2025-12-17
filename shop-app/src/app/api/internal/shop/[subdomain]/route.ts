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
    const shop = await prisma.shop.findFirst({
      where: {
        subdomain: subdomain,
      },
      select: {
        id: true,
        subdomain: true,
        name: true,
        coverUrl: true,
        isActive: true,
        contactPhone: true,
        contactEmail: true,
        bankName: true,
        bankAccount: true,
        accountHolder: true,
        theme: {
          select: {
            primaryColor: true,
            secondaryColor: true,
            logoUrl: true,
            faviconUrl: true,
            bannerUrl: true,
          },
        },
      },
    })

    return NextResponse.json({ shop })
  } catch (error) {
    console.error('Failed to fetch shop by subdomain:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
