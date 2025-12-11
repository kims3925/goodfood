'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock, User, Phone, Loader2, Check, AlertCircle, CheckCircle } from 'lucide-react'
import { useShop } from '@/contexts/ShopContext'
import { useShopUrl } from '@/hooks/useShopUrl'

interface FieldErrors {
  name?: string
  email?: string
  password?: string
  passwordConfirm?: string
  phone?: string
}

export default function SignupPage() {
  const router = useRouter()
  const { shop } = useShop()
  const { getPath, getApiPath } = useShopUrl()
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [agreements, setAgreements] = useState({
    all: false,
    terms: false,
    privacy: false,
    marketing: false,
  })

  // 개별 필드 검증
  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'name':
        if (!value.trim()) return '이름을 입력해주세요.'
        if (value.trim().length < 2) return '이름은 2자 이상이어야 합니다.'
        return undefined

      case 'email':
        if (!value.trim()) return '이메일을 입력해주세요.'
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) return '올바른 이메일 형식이 아닙니다.'
        return undefined

      case 'password':
        if (!value) return '비밀번호를 입력해주세요.'
        if (value.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
        if (!/[a-zA-Z]/.test(value)) return '영문자를 포함해주세요.'
        if (!/[0-9]/.test(value)) return '숫자를 포함해주세요.'
        return undefined

      case 'passwordConfirm':
        if (!value) return '비밀번호 확인을 입력해주세요.'
        if (value !== formData.password) return '비밀번호가 일치하지 않습니다.'
        return undefined

      case 'phone':
        if (value && !/^01[0-9]{8,9}$/.test(value.replace(/-/g, ''))) {
          return '올바른 휴대폰 번호 형식이 아닙니다.'
        }
        return undefined

      default:
        return undefined
    }
  }

  // 비밀번호 강도 계산
  const getPasswordStrength = (password: string): { level: number; text: string; color: string } => {
    if (!password) return { level: 0, text: '', color: '' }

    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++

    if (score <= 2) return { level: 1, text: '약함', color: 'bg-red-500' }
    if (score <= 3) return { level: 2, text: '보통', color: 'bg-yellow-500' }
    return { level: 3, text: '강함', color: 'bg-green-500' }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // 이미 터치된 필드는 실시간 검증
    if (touched[name]) {
      const error = validateField(name, value)
      setFieldErrors((prev) => ({ ...prev, [name]: error }))
    }

    // 비밀번호 변경 시 비밀번호 확인도 재검증
    if (name === 'password' && touched.passwordConfirm && formData.passwordConfirm) {
      const confirmError = formData.passwordConfirm !== value ? '비밀번호가 일치하지 않습니다.' : undefined
      setFieldErrors((prev) => ({ ...prev, passwordConfirm: confirmError }))
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    const error = validateField(name, value)
    setFieldErrors((prev) => ({ ...prev, [name]: error }))
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
    const errors: FieldErrors = {}

    const nameError = validateField('name', formData.name)
    const emailError = validateField('email', formData.email)
    const passwordError = validateField('password', formData.password)
    const passwordConfirmError = validateField('passwordConfirm', formData.passwordConfirm)
    const phoneError = validateField('phone', formData.phone)

    if (nameError) errors.name = nameError
    if (emailError) errors.email = emailError
    if (passwordError) errors.password = passwordError
    if (passwordConfirmError) errors.passwordConfirm = passwordConfirmError
    if (phoneError) errors.phone = phoneError

    setFieldErrors(errors)
    setTouched({ name: true, email: true, password: true, passwordConfirm: true, phone: true })

    if (Object.keys(errors).length > 0) {
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
      const response = await fetch(getApiPath('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone || undefined,
          shopId: shop?.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '회원가입 중 오류가 발생했습니다.')
        return
      }

      // 회원가입 성공 - 로그인 페이지로 이동
      router.push(getPath('/auth/login?signup=success'))
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const passwordStrength = getPasswordStrength(formData.password)
  const isPasswordMatch = formData.passwordConfirm && formData.password === formData.passwordConfirm

  return (
    <div className="bg-gray-50 flex justify-center py-6 px-4">
      <div className="max-w-md w-full">
        {/* Signup Form */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-center mb-6">회원가입</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
                  onBlur={handleBlur}
                  placeholder="이름을 입력하세요"
                  className={`w-full pl-10 pr-4 py-3 border rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none transition ${
                    touched.name && fieldErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {touched.name && fieldErrors.name && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.name}
                </p>
              )}
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
                  onBlur={handleBlur}
                  placeholder="example@email.com"
                  className={`w-full pl-10 pr-4 py-3 border rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none transition ${
                    touched.email && fieldErrors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {touched.email && fieldErrors.email && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.email}
                </p>
              )}
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
                  onBlur={handleBlur}
                  placeholder="영문, 숫자 포함 8자 이상"
                  className={`w-full pl-10 pr-12 py-3 border rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none transition ${
                    touched.password && fieldErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {/* 비밀번호 강도 표시 */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordStrength.level >= level ? passwordStrength.color : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    passwordStrength.level === 1 ? 'text-red-500' :
                    passwordStrength.level === 2 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    비밀번호 강도: {passwordStrength.text}
                  </p>
                </div>
              )}
              {touched.password && fieldErrors.password && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.password}
                </p>
              )}
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
                  onBlur={handleBlur}
                  placeholder="비밀번호를 다시 입력하세요"
                  className={`w-full pl-10 pr-12 py-3 border rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none transition ${
                    touched.passwordConfirm && fieldErrors.passwordConfirm ? 'border-red-500' :
                    isPasswordMatch ? 'border-green-500' : 'border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {isPasswordMatch && (
                <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  비밀번호가 일치합니다.
                </p>
              )}
              {touched.passwordConfirm && fieldErrors.passwordConfirm && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.passwordConfirm}
                </p>
              )}
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
                  onBlur={handleBlur}
                  placeholder="01012345678"
                  className={`w-full pl-10 pr-4 py-3 border rounded-md focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent outline-none transition ${
                    touched.phone && fieldErrors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {touched.phone && fieldErrors.phone && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.phone}
                </p>
              )}
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
            <Link href={getPath('/auth/login')} className="text-[#FF6B6B] font-medium hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
