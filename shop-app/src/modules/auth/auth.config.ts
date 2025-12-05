import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import KakaoProvider from 'next-auth/providers/kakao'
import NaverProvider from 'next-auth/providers/naver'
import { prisma } from '@/modules/common/utils/src/database/client'
import bcrypt from 'bcryptjs'
import { User } from '@bandauto/db'
import { headers } from 'next/headers'

type OAuthProvider = 'kakao' | 'naver'

type OAuthProfile = {
  provider: OAuthProvider
  providerId: string
  email: string | null
  name: string | null
  profileImage: string | null
}

async function upsertOAuthUser(profile: OAuthProfile): Promise<User> {
  // 1) provider id로 우선 탐색
  const existingByProvider = await prisma.user.findFirst({
    where: {
      oauthProvider: profile.provider,
      oauthProviderId: profile.providerId,
    },
  })
  if (existingByProvider) {
    return existingByProvider
  }

  // 2) 이메일 기반으로 기존 계정 연결 (기존 로컬 가입자도 OAuth로 전환)
  if (profile.email) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: profile.email },
    })
    if (existingByEmail) {
      return await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          oauthProvider: profile.provider,
          oauthProviderId: profile.providerId,
          profileImage: profile.profileImage ?? existingByEmail.profileImage,
        },
      })
    }
  }

  // 3) 신규 가입 (JIT provisioning)
  return prisma.user.create({
    data: {
      email:
        profile.email ??
        `${profile.provider}_${profile.providerId}@${profile.provider}.local`,
      name: profile.name,
      role: 'USER',
      oauthProvider: profile.provider,
      oauthProviderId: profile.providerId,
      profileImage: profile.profileImage,
    },
  })
}

function getCompleteUrl() {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || ''
  return `${base}/auth/complete`
}

// OAuth 프로필 매핑 함수들
const profileMappers: Record<OAuthProvider, (raw: any) => OAuthProfile> = {
  kakao: (raw) => ({
    provider: 'kakao',
    providerId: raw.id?.toString() ?? '',
    email: raw.kakao_account?.email ?? null,
    name: raw.kakao_account?.profile?.nickname ?? null,
    profileImage: raw.kakao_account?.profile?.profile_image_url ?? null,
  }),
  naver: (raw) => ({
    provider: 'naver',
    providerId: raw.response?.id ?? '',
    email: raw.response?.email ?? null,
    name: raw.response?.name ?? raw.response?.nickname ?? null,
    profileImage: raw.response?.profile_image ?? null,
  }),
}

function getRequestMeta() {
  try {
    const h = headers()
    const forwarded = h.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || null
    const userAgent = h.get('user-agent') || null
    return { ip, userAgent }
  } catch {
    return { ip: null, userAgent: null }
  }
}

async function logSignIn(opts: {
  userId?: number
  provider: string
  email?: string | null
  success: boolean
}) {
  const { ip, userAgent } = getRequestMeta()
  await prisma.userLoginLog.create({
    data: {
      userId: opts.userId,
      provider: opts.provider,
      email: opts.email ?? null,
      ip,
      userAgent,
      success: opts.success,
    },
  })
}

// 공통 OAuth 로그인 처리 함수
async function handleOAuthSignIn(
  provider: OAuthProvider,
  profile: any,
  user: any
): Promise<string | boolean> {
  const mapper = profileMappers[provider]
  let oauthProfile: OAuthProfile | null = null

  try {
    oauthProfile = mapper(profile)
    if (!oauthProfile.providerId) return false

    const dbUser = await upsertOAuthUser(oauthProfile)
    user.id = dbUser.id.toString()
    user.email = dbUser.email
    user.name = dbUser.name || dbUser.email

    await logSignIn({
      userId: dbUser.id,
      provider,
      email: dbUser.email,
      success: true,
    })

    // 온보딩 미완료 시 동의 화면으로 이동
    if (!dbUser.signupCompletedAt) {
      return getCompleteUrl()
    }
    return true
  } catch (error) {
    console.error(`${provider} 로그인 처리 오류:`, error)
    await logSignIn({
      provider,
      email: oauthProfile?.email,
      success: false,
    })
    return false
  }
}

// 쿠키 도메인 설정 (서브도메인 간 세션 공유)
function getCookieDomain(): string | undefined {
  // 환경변수에서 명시적으로 설정된 경우 사용
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN
  }

  // 로컬 개발 환경에서 lvh.me 사용 시 서브도메인 간 세션 공유
  if (process.env.NODE_ENV !== 'production') {
    // lvh.me를 사용하는 경우 .lvh.me 도메인 설정
    return '.lvh.me'
  }

  // 프로덕션: 환경변수에서 루트 도메인 가져오기 (예: .shop.com)
  return undefined
}

export const authOptions: NextAuthOptions = {
  // 서브도메인 간 세션 공유를 위한 쿠키 설정
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: getCookieDomain(),
      },
    },
    callbackUrl: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.callback-url'
          : 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: getCookieDomain(),
      },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Host-next-auth.csrf-token'
          : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID!,
      clientSecret: process.env.NAVER_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          return null
        }

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name || user.email,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      const provider = account?.provider ?? 'unknown'

      // OAuth 로그인 처리 (Kakao, Naver)
      if (provider === 'kakao' || provider === 'naver') {
        return handleOAuthSignIn(provider, profile, user)
      }

      // Credentials 로그인
      if (provider === 'credentials' && user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: Number(user.id) },
        })
        if (dbUser) {
          await logSignIn({
            userId: dbUser.id,
            provider,
            email: dbUser.email,
            success: true,
          })
        }
      }

      return true
    },

    async jwt({ token, user, account, trigger }) {
      // 최초 로그인 시 또는 세션 업데이트 시 DB에서 정보 가져오기
      if (user || trigger === 'update') {
        const userId = user?.id ?? token.id
        const dbUser = await prisma.user.findUnique({
          where: { id: Number(userId) },
          select: {
            id: true,
            email: true,
            name: true,
            signupCompletedAt: true,
            role: true,
          },
        })

        if (dbUser) {
          token.id = dbUser.id
          token.email = dbUser.email
          token.name = dbUser.name
          token.pendingSignup = !dbUser.signupCompletedAt
          token.role = dbUser.role
        }

        if (account) {
          token.provider = account.provider
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).provider = token.provider
        ;(session.user as any).pendingSignup = token.pendingSignup
        ;(session.user as any).role = token.role
        session.user.email = token.email as string
        session.user.name = (token.name as string) || session.user.email
      }
      return session
    },
  },
}
