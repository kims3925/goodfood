import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// 기본 설정 (DB에 없을 때 사용)
const defaultSettings = {
  shopName: '가족함께 스토어',
  shopUrl: 'https://bandauto.shop',
  shopDescription: '도매 상품을 합리적인 가격에 판매하는 온라인 쇼핑몰',

  // 배너 이미지 설정
  bannerImages: [
    { id: 1, url: '', link: '', title: '배너 1' },
    { id: 2, url: '', link: '', title: '배너 2' }
  ],

  // 카테고리 설정
  categories: [
    { id: 1, name: '육류', icon: '🥩', color: 'bg-red-50', enabled: true },
    { id: 2, name: '수산물', icon: '🐟', color: 'bg-blue-50', enabled: true },
    { id: 3, name: '채소', icon: '🥬', color: 'bg-green-50', enabled: true },
    { id: 4, name: '과일', icon: '🍎', color: 'bg-orange-50', enabled: true },
    { id: 5, name: '김치', icon: '🥢', color: 'bg-yellow-50', enabled: true },
    { id: 6, name: '가공품', icon: '📦', color: 'bg-purple-50', enabled: true },
    { id: 7, name: '특가', icon: '⚡', color: 'bg-pink-50', enabled: true },
    { id: 8, name: '더보기', icon: '➕', color: 'bg-gray-50', enabled: true }
  ],

  // 섹션 표시 설정
  showTimeSale: false,
  showBestProducts: false,

  paymentGateway: 'toss',
  tossClientKey: '',
  tossSecretKey: '',
  defaultShippingFee: 3000,
  freeShippingAmount: 50000,
  shippingPolicy: '50,000원 이상 무료배송',
  defaultMarginType: 'percentage',
  defaultMarginValue: 30,
  autoPublish: true,
  autoUpdateStock: true,
  autoUpdatePrice: false,
}

// 설정 파일 경로
const SETTINGS_FILE = path.join(process.cwd(), 'data', 'shop-settings.json')

// 설정 파일에서 로드하는 함수
function loadSettingsFromFile() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf-8')
      return JSON.parse(fileContent)
    }
  } catch (error) {
    console.error('설정 파일 로드 오류:', error)
  }
  return null
}

// 설정 파일에 저장하는 함수
function saveSettingsToFile(settings: any) {
  try {
    // data 디렉토리가 없으면 생성
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('설정 파일 저장 오류:', error)
    return false
  }
}

export async function GET() {
  try {
    // 파일에서 저장된 설정 로드
    let savedSettings = loadSettingsFromFile()

    if (!savedSettings) {
      // 저장된 설정이 없으면 기본값 + 환경변수 사용
      savedSettings = {
        ...defaultSettings,
        tossClientKey: process.env.TOSS_PAYMENTS_CLIENT_KEY || '',
        tossSecretKey: process.env.TOSS_PAYMENTS_SECRET_KEY || '',
      }
    }

    // 설정 반환 (실제 값 반환 - 프론트엔드에서 토글 기능 사용)
    const settings = {
      ...savedSettings
    }

    console.log('설정 로드 완료:', {
      shopName: settings.shopName,
      paymentGateway: settings.paymentGateway,
      hasTossClientKey: !!savedSettings.tossClientKey,
      hasTossSecretKey: !!savedSettings.tossSecretKey
    })

    return NextResponse.json({
      success: true,
      settings
    })
  } catch (error) {
    console.error('Failed to load shop settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load settings: ' + (error as Error).message,
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const settings = await req.json()

    console.log('쇼핑몰 설정 저장 요청:', {
      shopName: settings.shopName,
      paymentGateway: settings.paymentGateway,
      hasTossClientKey: !!settings.tossClientKey,
      hasTossSecretKey: !!settings.tossSecretKey
    })

    // 기존 설정 로드 (파일에서)
    let existingSettings = loadSettingsFromFile() || {}

    // 업데이트할 데이터 준비
    const updateData = {
      ...existingSettings,
      shopName: settings.shopName || defaultSettings.shopName,
      shopUrl: settings.shopUrl || defaultSettings.shopUrl,
      shopDescription: settings.shopDescription || defaultSettings.shopDescription,
      bannerImages: settings.bannerImages || defaultSettings.bannerImages,
      categories: settings.categories || defaultSettings.categories,
      showTimeSale: settings.showTimeSale ?? defaultSettings.showTimeSale,
      showBestProducts: settings.showBestProducts ?? defaultSettings.showBestProducts,
      paymentGateway: settings.paymentGateway || defaultSettings.paymentGateway,
      tossClientKey: settings.tossClientKey || '',
      tossSecretKey: settings.tossSecretKey || '',
      defaultShippingFee: settings.defaultShippingFee || defaultSettings.defaultShippingFee,
      freeShippingAmount: settings.freeShippingAmount || defaultSettings.freeShippingAmount,
      shippingPolicy: settings.shippingPolicy || defaultSettings.shippingPolicy,
      defaultMarginType: settings.defaultMarginType || defaultSettings.defaultMarginType,
      defaultMarginValue: settings.defaultMarginValue || defaultSettings.defaultMarginValue,
      autoPublish: settings.autoPublish ?? defaultSettings.autoPublish,
      autoUpdateStock: settings.autoUpdateStock ?? defaultSettings.autoUpdateStock,
      autoUpdatePrice: settings.autoUpdatePrice ?? defaultSettings.autoUpdatePrice,
      updatedAt: new Date().toISOString()
    }

    // 파일에 설정 저장
    const saveResult = saveSettingsToFile(updateData)

    if (!saveResult) {
      throw new Error('설정 파일 저장에 실패했습니다.')
    }

    console.log('쇼핑몰 설정 파일 저장 완료')

    return NextResponse.json({
      success: true,
      message: '설정이 저장되었습니다.',
    })
  } catch (error) {
    console.error('Failed to save shop settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save settings: ' + (error as Error).message,
      },
      { status: 500 }
    )
  }
}
