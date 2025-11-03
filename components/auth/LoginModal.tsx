'use client'

import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import Modal, { ModalFooter } from '../ui/Modal'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // 임시로 직접 API 호출로 대체 (NextAuth 대신)
      const response = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          csrfToken: 'temp' // 임시 CSRF 토큰
        }),
      })

      if (response.ok) {
        // 성공 시 모달 닫기 및 페이지 새로고침
        onClose()
        if (onSuccess) {
          onSuccess()
        } else {
          window.location.href = '/admin'
        }
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.error || '로그인에 실패했습니다.')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    // 모달 닫을 때 폼 초기화
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setError('')
    setIsLoading(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="로그인"
      size="md"
      closeOnOverlay={!isLoading}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="modal-email" className="block text-sm font-medium text-gray-900 mb-2">
            이메일
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
            <input
              id="modal-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder:text-gray-400"
              placeholder="your@email.com"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="modal-password" className="block text-sm font-medium text-text-primary mb-2">
            비밀번호
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={20} />
            <input
              id="modal-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 pl-10 pr-10 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-color focus:border-transparent placeholder:text-text-muted"
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <ModalFooter>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-md transition-colors duration-200 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-primary-color text-white rounded-md font-medium hover:bg-primary-hover transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-color focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </ModalFooter>
      </form>

      <div className="mt-4 pt-4 border-t border-divider text-center">
        <p className="text-sm text-text-secondary">
          계정이 없으신가요?{' '}
          <button 
            onClick={() => {
              handleClose()
              // 회원가입 모달 또는 페이지로 이동
              window.location.href = '/register'
            }}
            className="text-primary-color hover:text-primary-hover font-medium transition-colors"
          >
            회원가입
          </button>
        </p>
      </div>
    </Modal>
  )
}