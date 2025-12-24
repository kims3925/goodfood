import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@common/utils/src/database/client'
import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from '@/lib/rate-limit'

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

// 쿠키 도메인 설정
// 경로 기반 라우팅으로 변경되어 도메인 간 세션 공유 불필요
function getCookieDomain(): string | undefined {
  // 환경변수에서 명시적으로 설정된 경우 사용
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN
  }

  // 개발/프로덕션 모두 undefined로 설정 (현재 호스트에서만 쿠키 사용)
  return undefined
}

export const authOptions: NextAuthOptions = {
  // 도메인 간 세션 공유를 위한 쿠키 설정
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
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('[Auth] 이메일 또는 비밀번호 누락')
          return null
        }

        // Rate Limiting 체크
        try {
          const h = headers()
          const ip = getClientIp(h)
          const rateLimitResult = checkRateLimit(`login:${ip}`, RATE_LIMIT_PRESETS.login)

          if (!rateLimitResult.success) {
            console.log('[Auth] Rate limit 초과:', ip)
            // 로그인 실패 로그 기록
            await logSignIn({
              provider: 'credentials',
              email: credentials.email,
              success: false,
            })
            throw new Error('너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.')
          }
        } catch (error: any) {
          if (error.message?.includes('로그인 시도')) {
            throw error
          }
          // headers() 호출 실패 시 무시 (개발 환경에서 발생 가능)
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          console.log('[Auth] 사용자를 찾을 수 없음:', credentials.email)
          return null
        }

        if (!user.password) {
          console.log('[Auth] 비밀번호가 NULL임:', credentials.email)
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          console.log('[Auth] 비밀번호 불일치:', credentials.email)
          return null
        }

        console.log('[Auth] 로그인 성공:', credentials.email)
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
    // 도메인 간 리다이렉트 허용
    async redirect({ url, baseUrl }) {
      // 상대 경로는 그대로 허용
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }

      try {
        const urlObj = new URL(url)
        const baseUrlObj = new URL(baseUrl)

        // 같은 호스트면 허용
        if (urlObj.host === baseUrlObj.host) {
          return url
        }

        // 도메인 허용 (.lvh.me, 프로덕션 도메인)
        const allowedDomains = ['.lvh.me', process.env.COOKIE_DOMAIN].filter(Boolean)
        const isAllowedSubdomain = allowedDomains.some(
          (domain) => domain && urlObj.hostname.endsWith(domain.replace(/^\./, ''))
        )

        if (isAllowedSubdomain) {
          return url
        }
      } catch {
        // URL 파싱 실패 시 baseUrl 사용
      }

      // 기본: baseUrl로 리다이렉트
      return baseUrl
    },

    async signIn({ user, account }) {
      const provider = account?.provider ?? 'unknown'

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
