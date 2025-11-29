/**
 * Auth Service
 * 인증 관련 비즈니스 로직 레이어
 */

import prisma from '@/modules/common/utils/src/database/client'
import bcrypt from 'bcryptjs'
import {
  ValidationError,
  BusinessLogicError,
} from '@/modules/common/utils/src/errors/handlers'

// ============================================
// Types
// ============================================

export interface SignupDTO {
  email: string
  password: string
  name: string
  phone?: string
}

export interface UserResponse {
  id: string
  email: string
  name: string
  phone: string | null
}

/**
 * Auth Service
 */
export class AuthService {
  private emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  /**
   * 회원가입
   */
  async signup(data: SignupDTO): Promise<UserResponse> {
    const { email, password, name, phone } = data

    // 입력 검증
    this.validateSignupInput(email, password, name)

    // 중복 이메일 검사
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      throw new BusinessLogicError('이미 가입된 이메일입니다.')
    }

    // 비밀번호 해시화
    const passwordHash = await bcrypt.hash(password, 12)

    // 회원 생성
    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        name,
        phone: phone || null,
      },
    })

    return {
      id: user.id.toString(),
      email: user.email,
      name: user.name || '',
      phone: user.phone,
    }
  }

  /**
   * 이메일로 사용자 조회
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    })
  }

  /**
   * 비밀번호 검증
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword)
  }

  /**
   * 비밀번호 해시화
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
  }

  /**
   * 비밀번호 변경
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // 비밀번호 길이 검증
    if (newPassword.length < 8) {
      throw new ValidationError('새 비밀번호는 8자 이상이어야 합니다.')
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new ValidationError('사용자를 찾을 수 없습니다.')
    }

    if (!user.password) {
      throw new ValidationError('비밀번호가 설정되지 않은 계정입니다.')
    }

    // 현재 비밀번호 확인
    const isValid = await this.verifyPassword(currentPassword, user.password)
    if (!isValid) {
      throw new ValidationError('현재 비밀번호가 일치하지 않습니다.')
    }

    // 새 비밀번호 해시화 및 업데이트
    const hashedPassword = await this.hashPassword(newPassword)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })
  }

  /**
   * 입력 검증: 회원가입
   */
  private validateSignupInput(email: string, password: string, name: string): void {
    if (!email || !password || !name) {
      throw new ValidationError('필수 정보를 입력해주세요.')
    }

    if (!this.emailRegex.test(email)) {
      throw new ValidationError('올바른 이메일 형식이 아닙니다.')
    }

    if (password.length < 8) {
      throw new ValidationError('비밀번호는 8자 이상이어야 합니다.')
    }
  }
}

// Singleton 인스턴스
export const authService = new AuthService()

// Factory function
export function getAuthService(): AuthService {
  return authService
}
