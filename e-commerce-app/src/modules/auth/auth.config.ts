import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import KakaoProvider from 'next-auth/providers/kakao'
import NaverProvider from 'next-auth/providers/naver'
import { prisma } from '@/modules/common/utils/src/database/client'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
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

        // User 테이블에서 사용자 조회
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
    signIn: '/store/auth/login',
    signOut: '/store/auth/logout',
    error: '/store/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // 카카오 로그인 처리
      if (account?.provider === 'kakao') {
        const kakaoProfile = profile as any

        try {
          // 기존 OAuth 계정 확인
          let oauthAccount = await prisma.oAuthAccount.findUnique({
            where: {
              provider_providerId: {
                provider: 'kakao',
                providerId: kakaoProfile.id.toString(),
              },
            },
            include: { user: true },
          })

          if (oauthAccount) {
            // 기존 계정 - 토큰 업데이트
            await prisma.oAuthAccount.update({
              where: { id: oauthAccount.id },
              data: {
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at
                  ? new Date(account.expires_at * 1000)
                  : null,
              },
            })
            user.id = oauthAccount.user.id.toString()
          } else {
            // 새 계정 생성
            const kakaoEmail =
              kakaoProfile.kakao_account?.email ||
              `kakao_${kakaoProfile.id}@kakao.local`

            // 동일 이메일의 기존 사용자 확인
            let existingUser = await prisma.user.findUnique({
              where: { email: kakaoEmail },
            })

            if (!existingUser) {
              // 새 사용자 생성
              existingUser = await prisma.user.create({
                data: {
                  email: kakaoEmail,
                  name: kakaoProfile.kakao_account?.profile?.nickname || null,
                  role: 'CUSTOMER',
                },
              })
            }

            // OAuth 계정 연결
            await prisma.oAuthAccount.create({
              data: {
                userId: existingUser.id,
                provider: 'kakao',
                providerId: kakaoProfile.id.toString(),
                email: kakaoProfile.kakao_account?.email,
                nickname: kakaoProfile.kakao_account?.profile?.nickname,
                profileImage:
                  kakaoProfile.kakao_account?.profile?.profile_image_url,
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at
                  ? new Date(account.expires_at * 1000)
                  : null,
              },
            })

            user.id = existingUser.id.toString()
          }

          return true
        } catch (error) {
          console.error('카카오 로그인 처리 오류:', error)
          return false
        }
      }

      // 네이버 로그인 처리
      if (account?.provider === 'naver') {
        const naverProfile = profile as any

        try {
          // 기존 OAuth 계정 확인
          let oauthAccount = await prisma.oAuthAccount.findUnique({
            where: {
              provider_providerId: {
                provider: 'naver',
                providerId: naverProfile.response.id,
              },
            },
            include: { user: true },
          })

          if (oauthAccount) {
            // 기존 계정 - 토큰 업데이트
            await prisma.oAuthAccount.update({
              where: { id: oauthAccount.id },
              data: {
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at
                  ? new Date(account.expires_at * 1000)
                  : null,
              },
            })
            user.id = oauthAccount.user.id.toString()
          } else {
            // 새 계정 생성
            const naverEmail =
              naverProfile.response.email ||
              `naver_${naverProfile.response.id}@naver.local`

            // 동일 이메일의 기존 사용자 확인
            let existingUser = await prisma.user.findUnique({
              where: { email: naverEmail },
            })

            if (!existingUser) {
              // 새 사용자 생성
              existingUser = await prisma.user.create({
                data: {
                  email: naverEmail,
                  name: naverProfile.response.name || naverProfile.response.nickname || null,
                  role: 'CUSTOMER',
                },
              })
            }

            // OAuth 계정 연결
            await prisma.oAuthAccount.create({
              data: {
                userId: existingUser.id,
                provider: 'naver',
                providerId: naverProfile.response.id,
                email: naverProfile.response.email,
                nickname: naverProfile.response.nickname,
                profileImage: naverProfile.response.profile_image,
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at
                  ? new Date(account.expires_at * 1000)
                  : null,
              },
            })

            user.id = existingUser.id.toString()
          }

          return true
        } catch (error) {
          console.error('네이버 로그인 처리 오류:', error)
          return false
        }
      }

      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }
      if (account?.provider) {
        token.provider = account.provider
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).provider = token.provider
      }
      return session
    },
  },
}
