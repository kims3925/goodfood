'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock, User, Phone, Loader2, Check } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    phone: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [agreements, setAgreements] = useState({
    all: false,
    terms: false,
    privacy: false,
    marketing: false,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAgreementChange = (key: keyof typeof agreements) => {
    if (key === 'all') {
      const newValue = !agreements.all
      setAgreements({
        all: newValue,
        terms: newValue,
        privacy: newValue,
        marketing: newValue,
      })
    } else {
      const newAgreements = { ...agreements, [key]: !agreements[key] }
      newAgreements.all = newAgreements.terms && newAgreements.privacy && newAgreements.marketing
      setAgreements(newAgreements)
    }
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('이름을 입력해주세요.')
      return false
    }
    if (!formData.email.trim()) {
      setError('이메일을 입력해주세요.')
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('올바른 이메일 형식이 아닙니다.')
      return false
    }
    if (formData.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return false
    }
    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return false
    }
    if (!agreements.terms || !agreements.privacy) {
      setError('필수 약관에 동의해주세요.')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) return

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '회원가입 중 오류가 발생했습니다.')
        return
      }

      // 회원가입 성공 - 로그인 페이지로 이동
      router.push('/auth/login?signup=success')
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gray-50 flex justify-center py-6 px-4">
      <div className="max-w-md w-full">
        {/* Signup Form */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-center mb-6">회원가입</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="이름을 입력하세요"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                이메일 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="8자 이상 입력하세요"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Password Confirm */}
            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type={showPasswordConfirm ? 'text' : 'password'}
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                휴대폰 번호
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="01012345678"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            {/* Agreements */}
            <div className="border border-gray-200 rounded-md p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => handleAgreementChange('all')}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                    agreements.all ? 'bg-[#FF6B6B] border-[#FF6B6B]' : 'border-gray-300'
                  }`}
                >
                  {agreements.all && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="font-medium">전체 동의</span>
              </label>
              <hr />
              <label className="flex items-center gap-3 cursor-pointer text-sm">
                <div
                  onClick={() => handleAgreementChange('terms')}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                    agreements.terms ? 'bg-[#FF6B6B] border-[#FF6B6B]' : 'border-gray-300'
                  }`}
                >
                  {agreements.terms && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-gray-600">
                  <span className="text-red-500">[필수]</span> 이용약관 동의
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer text-sm">
                <div
                  onClick={() => handleAgreementChange('privacy')}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                    agreements.privacy ? 'bg-[#FF6B6B] border-[#FF6B6B]' : 'border-gray-300'
                  }`}
                >
                  {agreements.privacy && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-gray-600">
                  <span className="text-red-500">[필수]</span> 개인정보 수집 및 이용 동의
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer text-sm">
                <div
                  onClick={() => handleAgreementChange('marketing')}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                    agreements.marketing ? 'bg-[#FF6B6B] border-[#FF6B6B]' : 'border-gray-300'
                  }`}
                >
                  {agreements.marketing && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-gray-600">
                  <span className="text-gray-400">[선택]</span> 마케팅 정보 수신 동의
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#FF6B6B] text-white font-bold rounded-md hover:bg-[#ff5252] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  가입 중...
                </>
              ) : (
                '회원가입'
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-gray-600">
            이미 회원이신가요?{' '}
            <Link href="/auth/login" className="text-[#FF6B6B] font-medium hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
