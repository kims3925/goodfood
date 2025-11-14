import { prisma } from '@/lib/database/client'

/**
 * Band API 설정 타입
 */
export interface BandConfig {
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken?: string
}

/**
 * 사용자의 Band API 설정을 데이터베이스에서 로드합니다.
 *
 * @param userId - 사용자 ID
 * @returns Band API 설정 객체
 * @throws 사용자를 찾을 수 없거나 Band API 설정이 없는 경우 에러 발생
 */
export async function getBandConfig(userId: number): Promise<BandConfig> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      bandClientId: true,
      bandClientSecret: true,
      bandAccessToken: true,
    },
  })

  if (!user) {
    throw new Error('사용자를 찾을 수 없습니다.')
  }

  if (!user.bandAccessToken || !user.bandClientId || !user.bandClientSecret) {
    throw new Error(
      'Band API 설정이 필요합니다. 설정 페이지(/admin/settings/api)에서 Band API 인증 정보를 입력해주세요.'
    )
  }

  return {
    clientId: user.bandClientId,
    clientSecret: user.bandClientSecret,
    accessToken: user.bandAccessToken,
  }
}

/**
 * 사용자의 Band Access Token을 데이터베이스에서 로드합니다.
 *
 * @param userId - 사용자 ID
 * @returns Band Access Token
 * @throws 사용자를 찾을 수 없거나 토큰이 없는 경우 에러 발생
 */
export async function getBandAccessToken(userId: number): Promise<string> {
  const config = await getBandConfig(userId)
  return config.accessToken
}
