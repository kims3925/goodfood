import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { ChannelKind } from '@bandauto/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const channelId = parseInt(id)

    if (isNaN(channelId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 채널 ID입니다.' },
        { status: 400 }
      )
    }

    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        kind: ChannelKind.RETAIL,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        bankName: true,
        bankAccount: true,
        accountHolder: true,
      },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (!channel.bankName || !channel.bankAccount || !channel.accountHolder) {
      return NextResponse.json(
        { success: false, error: '채널에 입금정보가 등록되어 있지 않습니다.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      bankInfo: {
        bankName: channel.bankName,
        bankAccount: channel.bankAccount,
        accountHolder: channel.accountHolder,
      },
    })
  } catch (error) {
    console.error('채널 입금정보 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '입금정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
