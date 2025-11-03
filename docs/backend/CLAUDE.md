# BandAuto Backend - 백엔드 개발 가이드

## 프로젝트 개요

BandAuto 백엔드는 Next.js API Routes 기반의 서버리스 백엔드 시스템입니다. 도매 밴드 API 연동, AI 기반 상품 분석, 데이터베이스 관리, 자동화 워크플로우 등의 핵심 비즈니스 로직을 담당합니다.

## 기술 스택

### 백엔드 기술
- **Runtime**: Node.js
- **Framework**: Next.js 14 API Routes
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Cache**: Redis (Bull Queue)
- **Authentication**: NextAuth.js
- **AI Services**: Google Gemini API
- **Automation**: Playwright (브라우저 자동화)
- **File Processing**: ExcelJS
- **Email**: Nodemailer

### 외부 API 연동
- **Band API**: 밴드 플랫폼 게시물 수집
- **Google Gemini**: AI 기반 상품 분석
- **StrokePay**: 결제 링크 생성 (Playwright 자동화)
- **KakaoTalk**: 알림톡 발송
- **AWS S3**: 파일 저장소 (옵션)

## 프로젝트 구조

```
app/api/                        # Next.js API Routes
├── auth/                       # 인증 관련 API
│   ├── [...nextauth]/          # NextAuth.js 설정
│   ├── register/               # 회원가입
│   └── band/                   # Band API 연동
├── user/                       # 사용자 관련 API
│   └── bands/                  # 사용자 밴드 목록
├── wholesale/                  # 도매 관련 API
│   ├── bands/                  # 도매 밴드 관리
│   │   ├── route.ts           # 밴드 등록/조회
│   │   ├── comment-toggle/    # 댓글 수집 설정
│   │   └── [id]/              # 개별 밴드 관리
│   │       └── policy/        # 가격정책 설정
│   ├── collect/               # 상품 수집
│   │   └── route.ts           # 수집 실행 API
│   └── posts/                 # 수집된 게시물
│       ├── route.ts           # 게시물 조회
│       ├── confirm/           # 소싱 확정
│       └── delete/            # 게시물 삭제
├── products/                   # 상품 관리 API
│   └── route.ts               # 상품 CRUD
├── monitoring/                 # 모니터링 API
│   └── products/              # 상품 모니터링
├── settings/                   # 설정 관리 API
│   └── band/                  # 밴드 설정
├── cron/                       # 크론 작업 API
│   └── product-monitoring/    # 정기 모니터링
├── ai/                        # AI 서비스 API (예정)
│   ├── content/               # 컨텐츠 생성
│   └── pricing/               # 가격 책정
├── strokepay/                 # 스룩페이 API (예정)
│   ├── upload/                # 엑셀 업로드
│   └── links/                 # 결제 링크
├── automation/                # 자동화 API (예정)
│   ├── jobs/                  # 작업 관리
│   └── execute/               # 작업 실행
├── orders/                    # 주문 관리 API (예정)
└── notifications/             # 알림 API (예정)

lib/                            # 라이브러리 & 유틸리티
├── db.ts                      # Prisma 클라이언트
├── auth.ts                    # NextAuth 설정
├── gemini-ai.ts              # Gemini AI 서비스 (873라인)
├── band-client.ts            # Band API 클라이언트
├── band-token-refresh.ts     # Band 토큰 관리
├── product-monitor.ts        # 상품 모니터링 서비스
├── api/                      # API 클라이언트
│   ├── band-client.ts
│   ├── openai-client.ts
│   └── kakao-client.ts
├── automation/               # 자동화 서비스
│   ├── playwright-service.ts
│   └── strokepay-automation.ts
├── queue/                    # 작업 큐
│   └── automation-queue.ts
└── utils/                    # 유틸리티 함수
    ├── price-calculator.ts
    ├── content-parser.ts
    └── excel-generator.ts

services/                      # 비즈니스 로직 서비스
├── wholesale-band-service.ts
├── ai-content-service.ts
├── excel-service.ts
├── strokepay-automation-service.ts
├── page-generator-service.ts
├── retail-band-service.ts
├── order-management-service.ts
└── notification-service.ts

prisma/                       # 데이터베이스 관리
├── schema.prisma            # 데이터베이스 스키마
├── migrations/              # 마이그레이션 파일
└── seed.ts                  # 시드 데이터

types/                       # TypeScript 타입 정의
├── band.d.ts
├── product.d.ts
├── order.d.ts
├── automation.d.ts
└── api.d.ts
```

## 데이터베이스 스키마

### 완료된 모델 (6개)

```prisma
// 사용자 모델
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  bandAccessToken String?   // Band API 토큰
  bandClientId    String?   // Band API 클라이언트 ID
  bandClientSecret String?  // Band API 클라이언트 시크릿
  wholesaleBands  WholesaleBand[]
  collectedPosts  CollectedPost[]
  products        Product[]
  orders          Order[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// 도매 밴드 모델
model WholesaleBand {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  bandId            String    // Band API의 밴드 ID
  bandName          String    // 밴드 이름
  description       String?   // 밴드 설명
  memberCount       Int?      // 멤버 수
  isActive          Boolean   @default(true)
  includeComments   Boolean   @default(false)
  pricingPolicy     String?   // 가격 정책 텍스트
  collectedPosts    CollectedPost[]
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@unique([userId, bandId])
}

// 수집된 게시물 모델 (AI 분석 결과 포함)
model CollectedPost {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  wholesaleBandId   String
  wholesaleBand     WholesaleBand @relation(fields: [wholesaleBandId], references: [id])
  
  // Band API에서 수집한 원본 데이터
  originalPostId    String    // 원본 게시물 ID
  title             String    // 원본 제목
  content           String    @db.Text // 원본 내용
  author            String    // 작성자
  createdTime       DateTime  // 게시 시간
  images            String    // JSON 배열로 이미지 URLs
  commentCount      Int?      // 댓글 수
  comments          String?   @db.Text // JSON 배열로 댓글들
  
  // AI 분석 결과
  extractedPrice    Float?    // AI가 추출한 가격
  hookingTitle      String?   // AI 생성 후킹 제목 (20자)
  hookingContent    String?   @db.Text // AI 생성 후킹 콘텐츠
  productCategory   String?   // 상품 카테고리 (SEAFOOD, MEAT, etc.)
  priceOptions      String?   @db.Text // JSON 배열로 가격 옵션들
  shippingFee       Float?    // 배송비
  hasDeadline       Boolean?  // 마감 기한 존재 여부
  deadlineInfo      String?   // 마감 기한 정보
  
  // 처리 상태
  status            String    @default("COLLECTED") // COLLECTED, ANALYZED, CONFIRMED, DELETED
  processedAt       DateTime? // 처리 완료 시간
  
  // 확정 관련
  confirmedAt       DateTime? // 소싱 확정 시간
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@unique([userId, originalPostId])
  @@index([userId, status])
  @@index([wholesaleBandId, status])
}

// 소싱 확정된 상품 모델
model Product {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  collectedPostId   String    @unique // 연결된 수집 게시물
  
  // 상품 정보
  title             String    // 최종 상품명
  description       String    @db.Text // 최종 상품 설명
  originalPrice     Float     // 원가
  salePrice         Float     // 판매가
  category          String    // 상품 카테고리
  images            String    // JSON 배열로 이미지 URLs
  
  // 스룩페이 연동
  strokePayLink     String?   // 스룩페이 결제 링크
  strokePayStatus   String?   // 스룩페이 상태
  
  // 상태 관리
  status            String    @default("DRAFT") // DRAFT, ACTIVE, INACTIVE
  orders            Order[]
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([userId, status])
}

// 고객 모델
model Customer {
  id            String    @id @default(cuid())
  name          String
  phone         String?
  email         String?
  address       String?
  orders        Order[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([phone])
  @@index([email])
}

// 주문 모델
model Order {
  id              String    @id @default(cuid())
  orderNumber     String    @unique
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  productId       String
  product         Product   @relation(fields: [productId], references: [id])
  customerId      String
  customer        Customer  @relation(fields: [customerId], references: [id])
  
  // 주문 정보
  quantity        Int
  unitPrice       Float
  totalAmount     Float
  
  // 주문 상태
  status          String    @default("PENDING") // PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED
  
  // 배송 정보
  shippingAddress String?
  shippingMethod  String?
  trackingNumber  String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([userId, status])
  @@index([customerId])
}

// 소싱 사이트 모델 (참고용)
model SourcingSite {
  id          String    @id @default(cuid())
  name        String    @unique
  baseUrl     String
  apiKey      String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

## API 엔드포인트 상세

### 1. 인증 관련 API

#### NextAuth.js 통합 인증
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions = {
  providers: [
    CredentialsProvider({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' }
      },
      async authorize(credentials) {
        // 사용자 인증 로직
        const user = await verifyUser(credentials)
        return user ? { id: user.id, email: user.email } : null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
      }
      return token
    },
    async session({ session, token }) {
      session.userId = token.userId
      return session
    }
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

#### 회원가입 API
```typescript
// app/api/auth/register/route.ts
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json()
    
    // 이메일 중복 확인
    const existingUser = await db.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      return Response.json(
        { error: '이미 존재하는 이메일입니다.' },
        { status: 400 }
      )
    }
    
    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 12)
    
    // 사용자 생성
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    })
    
    return Response.json({
      message: '회원가입이 완료되었습니다.',
      user: { id: user.id, email: user.email }
    })
    
  } catch (error) {
    return Response.json(
      { error: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
```

### 2. 도매 밴드 관리 API

#### 밴드 등록 및 조회
```typescript
// app/api/wholesale/bands/route.ts
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { BandClient } from '@/lib/band-client'

export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.userId) {
      return Response.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }
    
    // 사용자의 도매 밴드 목록 조회
    const bands = await db.wholesaleBand.findMany({
      where: { userId: session.userId },
      include: {
        _count: {
          select: { collectedPosts: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
    
    return Response.json({ bands })
    
  } catch (error) {
    return Response.json(
      { error: '밴드 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.userId) {
      return Response.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }
    
    const { bandIds } = await request.json()
    
    const user = await db.user.findUnique({
      where: { id: session.userId }
    })
    
    if (!user?.bandAccessToken) {
      return Response.json(
        { error: 'Band API 토큰이 설정되지 않았습니다.' },
        { status: 400 }
      )
    }
    
    const bandClient = new BandClient(user.bandAccessToken)
    const registeredBands = []
    
    for (const bandId of bandIds) {
      try {
        // Band API에서 밴드 정보 조회
        const bandInfo = await bandClient.getBandInfo(bandId)
        
        // 중복 확인 후 등록
        const existingBand = await db.wholesaleBand.findUnique({
          where: {
            userId_bandId: {
              userId: session.userId,
              bandId
            }
          }
        })
        
        if (!existingBand) {
          const newBand = await db.wholesaleBand.create({
            data: {
              userId: session.userId,
              bandId,
              bandName: bandInfo.name,
              description: bandInfo.description,
              memberCount: bandInfo.member_count
            }
          })
          registeredBands.push(newBand)
        }
        
      } catch (error) {
        console.error(`밴드 ${bandId} 등록 실패:`, error)
      }
    }
    
    return Response.json({
      message: `${registeredBands.length}개 밴드가 등록되었습니다.`,
      registeredBands
    })
    
  } catch (error) {
    return Response.json(
      { error: '밴드 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
```

### 3. 상품 수집 API

#### 메인 수집 실행 API
```typescript
// app/api/wholesale/collect/route.ts
import { parallelBatchAnalyzeProducts } from '@/lib/gemini-ai'
import { BandClient } from '@/lib/band-client'

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.userId) {
      return Response.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }
    
    const { 
      bandIds, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 100 
    } = await request.json()
    
    // 수집 대상 밴드 조회
    const bandsToCollect = await db.wholesaleBand.findMany({
      where: {
        userId: session.userId,
        id: { in: bandIds }
      }
    })
    
    let totalCollected = 0
    let totalAnalyzed = 0
    const postsForAI: CollectedPostData[] = []
    
    // 각 밴드별로 게시물 수집
    for (const band of bandsToCollect) {
      try {
        const user = await db.user.findUnique({
          where: { id: session.userId }
        })
        
        if (!user?.bandAccessToken) continue
        
        const bandClient = new BandClient(user.bandAccessToken)
        
        // Band API에서 게시물 수집
        const posts = await bandClient.getPosts({
          bandId: band.bandId,
          after: startDate,
          before: endDate,
          count: limit
        })
        
        // 데이터베이스에 저장
        for (const post of posts) {
          try {
            const existingPost = await db.collectedPost.findUnique({
              where: {
                userId_originalPostId: {
                  userId: session.userId,
                  originalPostId: post.post_key
                }
              }
            })
            
            if (!existingPost) {
              const newPost = await db.collectedPost.create({
                data: {
                  userId: session.userId,
                  wholesaleBandId: band.id,
                  originalPostId: post.post_key,
                  title: post.content.substring(0, 100),
                  content: post.content,
                  author: post.author.name,
                  createdTime: new Date(post.created_at * 1000),
                  images: JSON.stringify(post.photos || []),
                  commentCount: post.comment_count,
                  status: 'COLLECTED'
                }
              })
              
              postsForAI.push({
                id: newPost.id,
                title: newPost.title,
                content: newPost.content,
                images: JSON.parse(newPost.images),
                pricingPolicy: band.pricingPolicy
              })
              
              totalCollected++
            }
          } catch (error) {
            console.error('게시물 저장 오류:', error)
          }
        }
        
      } catch (error) {
        console.error(`밴드 ${band.bandName} 수집 오류:`, error)
      }
    }
    
    // AI 분석 실행 (배치 처리)
    if (postsForAI.length > 0) {
      try {
        const aiAnalysisResults = await parallelBatchAnalyzeProducts(
          postsForAI,
          6,  // 배치 크기
          5   // 동시 처리 개수
        )
        
        // AI 분석 결과를 데이터베이스에 업데이트
        for (const result of aiAnalysisResults) {
          try {
            await db.collectedPost.update({
              where: { id: result.postId },
              data: {
                extractedPrice: result.extractedPrice,
                hookingTitle: result.hookingTitle,
                hookingContent: result.hookingContent,
                productCategory: result.productCategory,
                priceOptions: JSON.stringify(result.priceOptions || []),
                shippingFee: result.shippingFee,
                hasDeadline: result.hasDeadline,
                deadlineInfo: result.deadlineInfo,
                status: 'ANALYZED',
                processedAt: new Date()
              }
            })
            totalAnalyzed++
          } catch (error) {
            console.error('AI 분석 결과 저장 오류:', error)
          }
        }
        
      } catch (error) {
        console.error('AI 분석 오류:', error)
      }
    }
    
    return Response.json({
      success: true,
      totalCollected,
      totalAnalyzed,
      message: `${totalCollected}개 게시물 수집, ${totalAnalyzed}개 AI 분석 완료`
    })
    
  } catch (error) {
    console.error('수집 API 오류:', error)
    return Response.json(
      { error: '상품 수집 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
```

### 4. AI 서비스 (Gemini AI)

#### 핵심 분석 함수
```typescript
// lib/gemini-ai.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

// 배치 병렬 처리 함수 (메인 사용)
export async function parallelBatchAnalyzeProducts(
  posts: PostData[],
  batchSize: number = 6,
  concurrentBatches: number = 5
): Promise<AnalysisResult[]> {
  
  const results: AnalysisResult[] = []
  
  // 게시물을 배치로 분할
  const batches = []
  for (let i = 0; i < posts.length; i += batchSize) {
    batches.push(posts.slice(i, i + batchSize))
  }
  
  // 배치들을 동시 처리 그룹으로 분할
  for (let i = 0; i < batches.length; i += concurrentBatches) {
    const batchGroup = batches.slice(i, i + concurrentBatches)
    
    // 배치 그룹을 병렬로 처리
    const batchPromises = batchGroup.map(async (batch, batchIndex) => {
      try {
        return await analyzeBatchWithRetry(batch, 3) // 3회 재시도
      } catch (error) {
        console.error(`배치 ${i + batchIndex} 분석 실패:`, error)
        // 실패한 배치는 개별 분석으로 폴백
        return await fallbackToIndividualAnalysis(batch)
      }
    })
    
    const batchResults = await Promise.allSettled(batchPromises)
    
    // 결과 수집
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(...result.value)
      } else {
        console.error(`배치 그룹 ${i + index} 처리 실패`)
      }
    })
  }
  
  return results
}

// 배치 분석 (재시도 포함)
async function analyzeBatchWithRetry(
  batch: PostData[], 
  maxRetries: number
): Promise<AnalysisResult[]> {
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = buildBatchPrompt(batch)
      
      const result = await model.generateContent(prompt)
      const responseText = result.response.text()
      
      // JSON 파싱 및 정화
      const cleanedText = cleanupJSONString(responseText)
      const analysisResults = JSON.parse(cleanedText)
      
      // 결과 검증
      if (Array.isArray(analysisResults) && 
          analysisResults.length === batch.length) {
        
        return analysisResults.map((analysis, index) => ({
          postId: batch[index].id,
          extractedPrice: analysis.extractedPrice,
          hookingTitle: analysis.hookingTitle,
          hookingContent: analysis.hookingContent,
          productCategory: analysis.productCategory,
          priceOptions: analysis.priceOptions,
          shippingFee: analysis.shippingFee,
          hasDeadline: analysis.hasDeadline,
          deadlineInfo: analysis.deadlineInfo
        }))
      }
      
    } catch (error) {
      console.error(`배치 분석 ${attempt}회 시도 실패:`, error)
      if (attempt === maxRetries) throw error
      
      // 재시도 전 대기
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
  
  throw new Error('배치 분석 최대 재시도 횟수 초과')
}

// 프롬프트 템플릿
function buildBatchPrompt(batch: PostData[]): string {
  return `
다음 ${batch.length}개의 도매 상품 게시물을 한 번에 분석해주세요.
각 상품에 대해 JSON 배열 형식으로 응답해주세요.

**핵심 규칙:**
1. 제목: 정확히 20자 (가격/수량 제외)
2. 분류: SEAFOOD|MEAT|AGRICULTURE|PROCESSED|OTHER
3. 가격: 원문 그대로 추출 (계산 금지)
4. 후킹 콘텐츠: 150-200자 (가격 정보 제외)

**JSON 응답 형식:**
[
  {
    "extractedPrice": 15000,
    "hookingTitle": "신선한 자연산 고등어 특가",
    "hookingContent": "바다에서 갓 잡은 싱싱한 고등어...",
    "productCategory": "SEAFOOD",
    "priceOptions": [{"option": "1마리", "price": 15000}],
    "shippingFee": 3000,
    "hasDeadline": false,
    "deadlineInfo": null
  }
]

**분석 대상 게시물:**
${batch.map((post, index) => `
${index + 1}. 제목: ${post.title}
내용: ${post.content}
${post.pricingPolicy ? `가격정책: ${post.pricingPolicy}` : ''}
---
`).join('\n')}

위 ${batch.length}개 상품을 JSON 배열로 분석해주세요.`
}

// JSON 정화 함수
function cleanupJSONString(jsonText: string): string {
  return jsonText
    .replace(/```json\n?|\n?```/g, '')  // 코드 블록 제거
    .replace(/\/\/.*$/gm, '')           // 주석 제거  
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 다중 줄 주석 제거
    .replace(/,\s*([}\]])/g, '$1')      // trailing comma 제거
    .replace(/\n\s*\n/g, '\n')          // 빈 줄 제거
    .trim()
}
```

## 서비스 레이어

### Band API 클라이언트
```typescript
// lib/band-client.ts
export class BandClient {
  private accessToken: string
  private baseURL = 'https://openapi.band.us'
  
  constructor(accessToken: string) {
    this.accessToken = accessToken
  }
  
  // 사용자가 가입한 밴드 목록 조회
  async getUserBands(): Promise<BandInfo[]> {
    const response = await fetch(`${this.baseURL}/v2.1/bands`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`Band API 오류: ${response.status}`)
    }
    
    const data = await response.json()
    return data.result_data.bands
  }
  
  // 특정 밴드의 게시물 조회
  async getBandPosts(options: {
    bandId: string
    after?: string
    before?: string
    count?: number
  }): Promise<PostInfo[]> {
    const params = new URLSearchParams({
      band_key: options.bandId,
      count: (options.count || 20).toString()
    })
    
    if (options.after) params.append('after', options.after)
    if (options.before) params.append('before', options.before)
    
    const response = await fetch(
      `${this.baseURL}/v2.2/band/posts?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    )
    
    if (!response.ok) {
      throw new Error(`게시물 조회 오류: ${response.status}`)
    }
    
    const data = await response.json()
    return data.result_data.items
  }
  
  // 게시물의 댓글 조회
  async getPostComments(postKey: string): Promise<CommentInfo[]> {
    const response = await fetch(
      `${this.baseURL}/v2/band/post/comments?post_key=${postKey}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    )
    
    if (!response.ok) {
      throw new Error(`댓글 조회 오류: ${response.status}`)
    }
    
    const data = await response.json()
    return data.result_data.items
  }
}
```

### 상품 모니터링 서비스
```typescript
// lib/product-monitor.ts
export class ProductMonitor {
  private db: PrismaClient
  
  constructor() {
    this.db = new PrismaClient()
  }
  
  // 상품 상태 모니터링
  async monitorProducts(userId: string): Promise<MonitoringResult> {
    const stats = {
      total: 0,
      collected: 0,
      analyzed: 0,
      confirmed: 0,
      failed: 0
    }
    
    // 전체 통계 계산
    const posts = await this.db.collectedPost.findMany({
      where: { userId },
      select: { status: true }
    })
    
    stats.total = posts.length
    stats.collected = posts.filter(p => p.status === 'COLLECTED').length
    stats.analyzed = posts.filter(p => p.status === 'ANALYZED').length
    stats.confirmed = posts.filter(p => p.status === 'CONFIRMED').length
    stats.failed = posts.filter(p => p.status === 'FAILED').length
    
    // 최근 활동 조회
    const recentActivity = await this.db.collectedPost.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: {
        wholesaleBand: {
          select: { bandName: true }
        }
      }
    })
    
    return {
      stats,
      recentActivity: recentActivity.map(post => ({
        id: post.id,
        title: post.title,
        status: post.status,
        bandName: post.wholesaleBand.bandName,
        updatedAt: post.updatedAt
      }))
    }
  }
  
  // 실패한 게시물 재처리
  async retryFailedPosts(userId: string): Promise<number> {
    const failedPosts = await this.db.collectedPost.findMany({
      where: {
        userId,
        status: 'FAILED'
      },
      take: 50 // 한 번에 50개씩 처리
    })
    
    let successCount = 0
    
    for (const post of failedPosts) {
      try {
        // AI 재분석 실행
        const analysis = await analyzeProductContent({
          title: post.title,
          content: post.content,
          images: JSON.parse(post.images || '[]')
        })
        
        // 결과 업데이트
        await this.db.collectedPost.update({
          where: { id: post.id },
          data: {
            extractedPrice: analysis.extractedPrice,
            hookingTitle: analysis.hookingTitle,
            hookingContent: analysis.hookingContent,
            productCategory: analysis.productCategory,
            priceOptions: JSON.stringify(analysis.priceOptions),
            shippingFee: analysis.shippingFee,
            hasDeadline: analysis.hasDeadline,
            deadlineInfo: analysis.deadlineInfo,
            status: 'ANALYZED',
            processedAt: new Date()
          }
        })
        
        successCount++
        
      } catch (error) {
        console.error(`게시물 ${post.id} 재처리 실패:`, error)
      }
    }
    
    return successCount
  }
}
```

## 자동화 시스템 (예정 기능)

### Playwright 기반 스룩페이 자동화
```typescript
// lib/automation/strokepay-automation.ts
import { chromium, Browser, Page } from 'playwright'

export class StrokePayAutomation {
  private browser: Browser | null = null
  private page: Page | null = null
  
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: process.env.STROKEPAY_HEADLESS === 'true'
    })
    this.page = await this.browser.newPage()
  }
  
  // 스룩페이 로그인
  async login(credentials: {
    id: string
    password: string
  }): Promise<boolean> {
    try {
      await this.page!.goto('https://strokepay.com/login')
      
      // 로그인 폼 작성
      await this.page!.fill('[name="user_id"]', credentials.id)
      await this.page!.fill('[name="password"]', credentials.password)
      
      // 로그인 버튼 클릭
      await this.page!.click('button[type="submit"]')
      
      // 로그인 성공 확인
      await this.page!.waitForNavigation()
      const currentUrl = this.page!.url()
      
      return currentUrl.includes('/dashboard')
      
    } catch (error) {
      console.error('스룩페이 로그인 실패:', error)
      return false
    }
  }
  
  // 엑셀 파일 업로드
  async uploadExcel(filePath: string): Promise<string | null> {
    try {
      await this.page!.goto('https://strokepay.com/product/upload')
      
      // 파일 업로드
      const fileInput = await this.page!.locator('input[type="file"]')
      await fileInput.setInputFiles(filePath)
      
      // 업로드 버튼 클릭
      await this.page!.click('#upload-button')
      
      // 업로드 완료 대기
      await this.page!.waitForSelector('.upload-success')
      
      // 결과 URL 추출
      const resultUrl = await this.page!.locator('#result-url').textContent()
      return resultUrl
      
    } catch (error) {
      console.error('엑셀 업로드 실패:', error)
      return null
    }
  }
  
  async close(): Promise<void> {
    if (this.page) await this.page.close()
    if (this.browser) await this.browser.close()
  }
}
```

### 작업 큐 시스템 (Bull Queue)
```typescript
// lib/queue/automation-queue.ts
import Bull from 'bull'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)
const automationQueue = new Bull('automation', { redis })

// 작업 타입 정의
interface AutomationJob {
  type: 'COLLECT_PRODUCTS' | 'GENERATE_EXCEL' | 'UPLOAD_STROKEPAY' | 'POST_TO_BANDS'
  userId: string
  data: any
}

// 작업 처리자 등록
automationQueue.process('COLLECT_PRODUCTS', async (job) => {
  const { userId, bandIds } = job.data
  
  try {
    // 상품 수집 실행
    const result = await collectProductsFromBands(userId, bandIds)
    
    // 진행률 업데이트
    job.progress(100)
    
    return result
    
  } catch (error) {
    console.error('상품 수집 작업 실패:', error)
    throw error
  }
})

automationQueue.process('GENERATE_EXCEL', async (job) => {
  const { productIds } = job.data
  
  try {
    const excelBuffer = await generateProductExcel(productIds)
    const filePath = await saveExcelFile(excelBuffer)
    
    return { filePath }
    
  } catch (error) {
    console.error('엑셀 생성 작업 실패:', error)
    throw error
  }
})

// 작업 추가 함수
export async function addAutomationJob(
  type: AutomationJob['type'], 
  data: any
): Promise<Bull.Job> {
  return automationQueue.add(type, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  })
}

// 작업 상태 조회
export async function getJobStatus(jobId: string): Promise<any> {
  const job = await automationQueue.getJob(jobId)
  
  if (!job) return null
  
  return {
    id: job.id,
    data: job.data,
    progress: job.progress(),
    state: await job.getState(),
    result: job.returnvalue,
    error: job.failedReason
  }
}
```

## 환경 변수 설정

```env
# 데이터베이스
DATABASE_URL="file:./dev.db"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# AI 서비스
GEMINI_API_KEY="your-gemini-api-key"
OPENAI_API_KEY="sk-your-openai-key"

# Band API
BAND_CLIENT_ID="your-band-client-id"
BAND_CLIENT_SECRET="your-band-client-secret"

# 스룩페이 자동화
STROKEPAY_ID="your-strokepay-id"
STROKEPAY_PASSWORD="your-strokepay-password"
STROKEPAY_HEADLESS="false"

# Redis (작업 큐용)
REDIS_URL="redis://localhost:6379"

# 이메일 서비스
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# AWS S3 (파일 저장소)
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="ap-northeast-2"
AWS_S3_BUCKET="bandauto-assets"

# 카카오 알림톡
KAKAO_ALIMTALK_KEY="your-kakao-key"
KAKAO_TEMPLATE_CODE="your-template-code"
```

## 개발 및 배포

### 개발 환경 설정
```bash
# 데이터베이스 초기화
npx prisma generate
npx prisma db push

# 개발 서버 실행
npm run dev

# 데이터베이스 관리
npx prisma studio

# 테스트 데이터 생성
npx tsx prisma/seed.ts
```

### API 테스트
```bash
# Band API 연결 테스트
curl -X GET http://localhost:3000/api/test/band/user-bands

# 상품 수집 테스트
curl -X POST http://localhost:3000/api/wholesale/collect \
  -H "Content-Type: application/json" \
  -d '{"bandIds": ["test-band-id"]}'

# AI 분석 테스트
curl -X POST http://localhost:3000/api/test/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"title": "테스트 상품", "content": "상품 설명..."}'
```

### 성능 최적화
- Database Connection Pooling
- Redis 캐싱 전략
- API Rate Limiting
- Background Job Processing
- Image Optimization

### 모니터링 및 로깅
- API 응답 시간 측정
- 에러 추적 (Sentry 연동)
- 데이터베이스 쿼리 최적화
- AI API 사용량 모니터링

## 보안 고려사항

- 환경 변수를 통한 민감 정보 관리
- API 요청에 대한 rate limiting
- 입력 데이터 검증 (Zod 스키마)
- SQL Injection 방지 (Prisma ORM)
- CORS 정책 설정
- JWT 토큰 보안