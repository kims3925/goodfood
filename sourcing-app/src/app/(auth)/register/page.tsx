'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserPlus, Mail, Lock, User, ArrowLeft, Store, Package,
  Phone, Building2, FileText, CheckCircle2, AlertCircle,
  ShoppingBag, CreditCard, ExternalLink,
} from 'lucide-react'

type RegisterType = 'SELLER' | 'PRODUCT_PROVIDER'

export default function RegisterPage() {
  const router = useRouter()
  const [registerType, setRegisterType] = useState<RegisterType>('SELLER')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // 공통 필드
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  // 판매자 등록 전용 필드
  const [companyName, setCompanyName] = useState('')
  const [businessNumber, setBusinessNumber] = useState('')
  const [onlineSalesNumber, setOnlineSalesNumber] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (!email || !name) {
      setError('이름과 이메일은 필수입니다.')
      return
    }
    if (registerType === 'SELLER' && !companyName) {
      setError('판매자 등록 시 회사명/상호는 필수입니다.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone: phone || undefined,
          sellerType: registerType,
          companyName: registerType === 'SELLER' ? companyName : undefined,
          businessNumber: registerType === 'SELLER' ? businessNumber : undefined,
          onlineSalesNumber: registerType === 'SELLER' ? onlineSalesNumber : undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.error || '회원가입에 실패했습니다.')
      }
    } catch {
      setError('회원가입 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">가입 완료!</h1>
          <p className="text-gray-600 mb-6">
            {registerType === 'SELLER'
              ? '판매자 등록이 완료되었습니다. 로그인 후 채널 연결과 상품 발행을 시작하세요.'
              : '상품등록 가입이 완료되었습니다. 로그인 후 상품을 등록하세요.'}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            로그인하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 sm:p-8">
        {/* 뒤로가기 */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
        >
          <ArrowLeft size={16} />
          홈으로
        </button>

        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-3">
            <UserPlus className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">회원가입</h1>
        </div>

        {/* 탭 메뉴 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setRegisterType('SELLER'); setError('') }}
            className={`relative p-3 rounded-xl border-2 text-left transition-all ${
              registerType === 'SELLER'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Store size={18} className={registerType === 'SELLER' ? 'text-blue-600' : 'text-gray-400'} />
              <span className={`text-sm font-bold ${registerType === 'SELLER' ? 'text-blue-700' : 'text-gray-700'}`}>
                판매자 등록
              </span>
            </div>
            {registerType === 'SELLER' && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 size={16} className="text-blue-500" />
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setRegisterType('PRODUCT_PROVIDER'); setError('') }}
            className={`relative p-3 rounded-xl border-2 text-left transition-all ${
              registerType === 'PRODUCT_PROVIDER'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Package size={18} className={registerType === 'PRODUCT_PROVIDER' ? 'text-green-600' : 'text-gray-400'} />
              <span className={`text-sm font-bold ${registerType === 'PRODUCT_PROVIDER' ? 'text-green-700' : 'text-gray-700'}`}>
                상품 등록
              </span>
            </div>
            {registerType === 'PRODUCT_PROVIDER' && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 size={16} className="text-green-500" />
              </div>
            )}
          </button>
        </div>

        {/* 탭 설명 */}
        <div className={`rounded-lg p-3 mb-5 text-sm leading-relaxed ${
          registerType === 'SELLER'
            ? 'bg-blue-50 border border-blue-200 text-blue-800'
            : 'bg-green-50 border border-green-200 text-green-800'
        }`}>
          {registerType === 'SELLER' ? (
            <div className="flex gap-2">
              <ExternalLink size={16} className="flex-shrink-0 mt-0.5" />
              <span>자신의 쇼핑몰에 상품을 등록하고, 상품 URL을 첨부하여 소매밴드로 발행합니다. 자체 결제/정산 시스템을 사용합니다.</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <ShoppingBag size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <p>BandAuto 쇼핑몰에 상품을 등록하고, 결제 URL을 자동 생성합니다.</p>
                <p className="mt-1 text-xs opacity-80">
                  <CreditCard size={12} className="inline mr-1" />
                  BandAuto가 토스페이먼츠로 결제를 처리하고, 상품별 판매자에게 정산합니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-5 text-sm">
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 판매자 등록 전용 필드 */}
          {registerType === 'SELLER' && (
            <div className="space-y-4 pb-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">사업자 정보</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">회사명 / 상호 *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="주식회사 ABC"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">사업자등록번호</label>
                  <input
                    type="text"
                    value={businessNumber}
                    onChange={e => setBusinessNumber(e.target.value)}
                    placeholder="000-00-00000"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">통신판매번호 <span className="text-gray-400 text-xs">(선택)</span></label>
                  <input
                    type="text"
                    value={onlineSalesNumber}
                    onChange={e => setOnlineSalesNumber(e.target.value)}
                    placeholder="제0000-서울-0000호"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 상품등록 고객 안내 */}
          {registerType === 'PRODUCT_PROVIDER' && (
            <div className="bg-gray-50 rounded-lg p-4 mb-2 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">상품등록 안내</p>
              <ul className="text-xs text-gray-600 space-y-1.5">
                <li className="flex gap-2">
                  <span className="text-green-500">•</span>
                  등록한 상품은 BandAuto 쇼핑몰에서 판매됩니다.
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500">•</span>
                  토스페이먼츠를 통해 결제가 처리됩니다.
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500">•</span>
                  상품별 판매자 관리로 투명하게 정산됩니다.
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500">•</span>
                  별도 사업자등록 없이 상품 등록이 가능합니다.
                </li>
              </ul>
            </div>
          )}

          {/* 공통 필드 */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">담당자 정보</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="담당자 이름"
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8자 이상"
                  required
                  minLength={8}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 재입력"
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {passwordConfirm && password !== passwordConfirm && (
                <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white ${
              registerType === 'SELLER'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isLoading ? '가입 중...' : registerType === 'SELLER' ? '판매자 등록 완료' : '상품등록 가입 완료'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-5">
          이미 계정이 있으신가요?{' '}
          <button onClick={() => router.push('/login')} className="text-blue-600 font-medium hover:underline">
            로그인
          </button>
        </p>
      </div>
    </div>
  )
}
