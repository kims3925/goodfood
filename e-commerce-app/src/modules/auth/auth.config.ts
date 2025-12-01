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
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // 카카오 로그인 처리
      if (account?.provider === 'kakao') {
        const kakaoProfile = profile as any

        try {
          // 기존 사용자 확인 (oauthProvider + oauthProviderId로 조회)
          let existingUser = await prisma.user.findFirst({
            where: {
              oauthProvider: 'kakao',
              oauthProviderId: kakaoProfile.id.toString(),
            },
          })

          if (existingUser) {
            // 기존 사용자로 로그인
            user.id = existingUser.id.toString()
          } else {
            // 새 사용자 생성
            const kakaoEmail =
              kakaoProfile.kakao_account?.email ||
              `kakao_${kakaoProfile.id}@kakao.local`

            // 동일 이메일의 기존 사용자 확인
            const emailUser = await prisma.user.findUnique({
              where: { email: kakaoEmail },
            })

            if (emailUser && !emailUser.oauthProvider) {
              // 기존 이메일 계정에 OAuth 정보 추가
              await prisma.user.update({
                where: { id: emailUser.id },
                data: {
                  oauthProvider: 'kakao',
                  oauthProviderId: kakaoProfile.id.toString(),
                  profileImage:
                    kakaoProfile.kakao_account?.profile?.profile_image_url,
                },
              })
              user.id = emailUser.id.toString()
            } else {
              // 완전히 새로운 사용자 생성
              const newUser = await prisma.user.create({
                data: {
                  email: kakaoEmail,
                  name:
                    kakaoProfile.kakao_account?.profile?.nickname || null,
                  role: 'CUSTOMER',
                  oauthProvider: 'kakao',
                  oauthProviderId: kakaoProfile.id.toString(),
                  profileImage:
                    kakaoProfile.kakao_account?.profile?.profile_image_url,
                },
              })
              user.id = newUser.id.toString()
            }
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
          // 기존 사용자 확인 (oauthProvider + oauthProviderId로 조회)
          let existingUser = await prisma.user.findFirst({
            where: {
              oauthProvider: 'naver',
              oauthProviderId: naverProfile.response.id,
            },
          })

          if (existingUser) {
            // 기존 사용자로 로그인
            user.id = existingUser.id.toString()
          } else {
            // 새 사용자 생성
            const naverEmail =
              naverProfile.response.email ||
              `naver_${naverProfile.response.id}@naver.local`

            // 동일 이메일의 기존 사용자 확인
            const emailUser = await prisma.user.findUnique({
              where: { email: naverEmail },
            })

            if (emailUser && !emailUser.oauthProvider) {
              // 기존 이메일 계정에 OAuth 정보 추가
              await prisma.user.update({
                where: { id: emailUser.id },
                data: {
                  oauthProvider: 'naver',
                  oauthProviderId: naverProfile.response.id,
                  profileImage: naverProfile.response.profile_image,
                },
              })
              user.id = emailUser.id.toString()
            } else {
              // 완전히 새로운 사용자 생성
              const newUser = await prisma.user.create({
                data: {
                  email: naverEmail,
                  name:
                    naverProfile.response.name ||
                    naverProfile.response.nickname ||
                    null,
                  role: 'CUSTOMER',
                  oauthProvider: 'naver',
                  oauthProviderId: naverProfile.response.id,
                  profileImage: naverProfile.response.profile_image,
                },
              })
              user.id = newUser.id.toString()
            }
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
