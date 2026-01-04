export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import os from 'os'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * ~ 경로를 실제 홈 디렉토리 경로로 변환
 */
function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return filePath
}

/**
 * URL에서 이미지 파일 경로 추출 후 삭제
 */
async function deleteImageFromUrl(imageUrl: string): Promise<void> {
  if (!imageUrl) return

  // /api/image/shop/{fileName} 형태의 URL에서 파일명 추출
  const match = imageUrl.match(/\/api\/image\/shop\/(.+)$/)
  if (!match) return

  const [, fileName] = match
  const basePath = process.env.SHOP_IMAGE_STORAGE_PATH || '~/assets/images/shop'
  const expandedBasePath = expandPath(basePath)
  const filePath = path.join(expandedBasePath, fileName)

  try {
    await unlink(filePath)
    console.log(`이미지 삭제 완료: ${filePath}`)
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error(`이미지 삭제 실패: ${filePath}`, error)
    }
  }
}

/**
 * GET /api/shop/[id]
 * 쇼핑몰 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 쇼핑몰 ID입니다.' },
        { status: 400 }
      )
    }

    const shop = await prisma.shop.findFirst({
      where: {
        id,
        userId: currentUser.userId,
      },
      include: {
        theme: true,
        _count: {
          select: {
            publishedProducts: true,
            orders: true,
          },
        },
      },
    })

    if (!shop) {
      return NextResponse.json(
        { success: false, error: '쇼핑몰을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: shop,
    })
  } catch (error) {
    console.error('쇼핑몰 상세 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '쇼핑몰을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/shop/[id]
 * 쇼핑몰 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 쇼핑몰 ID입니다.' },
        { status: 400 }
      )
    }

    const existingShop = await prisma.shop.findFirst({
      where: {
        id,
        userId: currentUser.userId,
      },
      include: {
        theme: true,
      },
    })

    if (!existingShop) {
      return NextResponse.json(
        { success: false, error: '쇼핑몰을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      subdomain,
      name,
      coverUrl,
      bankName,
      bankAccount,
      accountHolder,
      contactPhone,
      contactEmail,
      ownerName,
      businessNumber,
      isActive,
      theme,
    } = body

    // 도메인 변경 시 중복 체크
    if (subdomain && subdomain !== existingShop.subdomain) {
      const subdomainRegex = /^[a-z0-9-]+$/
      if (!subdomainRegex.test(subdomain)) {
        return NextResponse.json(
          { success: false, error: '도메인은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.' },
          { status: 400 }
        )
      }

      const duplicateShop = await prisma.shop.findUnique({
        where: { subdomain },
      })

      if (duplicateShop) {
        return NextResponse.json(
          { success: false, error: '이미 사용 중인 도메인입니다.' },
          { status: 400 }
        )
      }
    }

    // 기존 이미지 삭제 (새 이미지로 교체되는 경우)
    if (coverUrl !== undefined && coverUrl !== existingShop.coverUrl && existingShop.coverUrl) {
      await deleteImageFromUrl(existingShop.coverUrl)
    }

    // 쇼핑몰 업데이트 데이터
    const updateData: any = {}

    if (subdomain !== undefined) updateData.subdomain = subdomain
    if (name !== undefined) updateData.name = name
    if (coverUrl !== undefined) updateData.coverUrl = coverUrl || null
    if (bankName !== undefined) updateData.bankName = bankName || null
    if (bankAccount !== undefined) updateData.bankAccount = bankAccount || null
    if (accountHolder !== undefined) updateData.accountHolder = accountHolder || null
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone || null
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail || null
    if (ownerName !== undefined) updateData.ownerName = ownerName || null
    if (businessNumber !== undefined) updateData.businessNumber = businessNumber || null
    if (isActive !== undefined) updateData.isActive = isActive

    // 트랜잭션으로 쇼핑몰과 테마 함께 업데이트
    const updatedShop = await prisma.$transaction(async (tx) => {
      // 쇼핑몰 업데이트
      const shop = await tx.shop.update({
        where: { id },
        data: updateData,
      })

      // 테마 업데이트 (있는 경우)
      if (theme) {
        const existingTheme = existingShop.theme

        // 기존 테마 이미지 삭제 (새 이미지로 교체되는 경우)
        if (existingTheme) {
          if (theme.logoUrl !== undefined && theme.logoUrl !== existingTheme.logoUrl && existingTheme.logoUrl) {
            await deleteImageFromUrl(existingTheme.logoUrl)
          }
          if (theme.faviconUrl !== undefined && theme.faviconUrl !== existingTheme.faviconUrl && existingTheme.faviconUrl) {
            await deleteImageFromUrl(existingTheme.faviconUrl)
          }
          if (theme.bannerUrl !== undefined && theme.bannerUrl !== existingTheme.bannerUrl && existingTheme.bannerUrl) {
            await deleteImageFromUrl(existingTheme.bannerUrl)
          }
        }

        if (existingTheme) {
          await tx.shopTheme.update({
            where: { shopId: id },
            data: {
              primaryColor: theme.primaryColor || null,
              secondaryColor: theme.secondaryColor || null,
              logoUrl: theme.logoUrl || null,
              faviconUrl: theme.faviconUrl || null,
              bannerUrl: theme.bannerUrl || null,
            },
          })
        } else {
          await tx.shopTheme.create({
            data: {
              shopId: id,
              primaryColor: theme.primaryColor || null,
              secondaryColor: theme.secondaryColor || null,
              logoUrl: theme.logoUrl || null,
              faviconUrl: theme.faviconUrl || null,
              bannerUrl: theme.bannerUrl || null,
            },
          })
        }
      }

      // 업데이트된 쇼핑몰 반환
      return tx.shop.findUnique({
        where: { id },
        include: {
          theme: true,
          _count: {
            select: {
              publishedProducts: true,
              orders: true,
            },
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: updatedShop,
    })
  } catch (error) {
    console.error('쇼핑몰 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '쇼핑몰 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/shop/[id]
 * 쇼핑몰 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 쇼핑몰 ID입니다.' },
        { status: 400 }
      )
    }

    const shop = await prisma.shop.findFirst({
      where: {
        id,
        userId: currentUser.userId,
      },
      include: {
        theme: true,
      },
    })

    if (!shop) {
      return NextResponse.json(
        { success: false, error: '쇼핑몰을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 쇼핑몰 삭제 전 이미지 파일 삭제
    const imagesToDelete: string[] = []
    if (shop.coverUrl) imagesToDelete.push(shop.coverUrl)
    if (shop.theme?.logoUrl) imagesToDelete.push(shop.theme.logoUrl)
    if (shop.theme?.faviconUrl) imagesToDelete.push(shop.theme.faviconUrl)
    if (shop.theme?.bannerUrl) imagesToDelete.push(shop.theme.bannerUrl)

    // 이미지 파일들 삭제 (비동기로 병렬 처리)
    await Promise.all(imagesToDelete.map(deleteImageFromUrl))

    await prisma.shop.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: '쇼핑몰이 삭제되었습니다.',
    })
  } catch (error) {
    console.error('쇼핑몰 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '쇼핑몰 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
