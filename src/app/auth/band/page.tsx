'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

export default function BandAuthPage() {
  const [authUrl, setAuthUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [authStatus, setAuthStatus] = useState<'pending' | 'success' | 'error'>('pending')

  useEffect(() => {
    generateAuthUrl()
  }, [])

  const generateAuthUrl = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/auth/band')
      const data = await response.json()
      
      if (data.success) {
        setAuthUrl(data.authUrl)
      } else {
        setError(data.error || '인증 URL 생성에 실패했습니다.')
      }
    } catch (err) {
      setError('인증 URL 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAuthClick = () => {
    if (authUrl) {
      // 새 창에서 인증 진행
      const popup = window.open(
        authUrl,
        'bandAuth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      )

      // 팝업 창 모니터링
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup)
          // 인증 완료 후 페이지 새로고침 또는 상태 확인
          checkAuthStatus()
        }
      }, 1000)
    }
  }

  const checkAuthStatus = async () => {
    try {
      // 인증 성공 여부를 확인하는 API 호출 (구현 필요)
      // 여기서는 간단히 성공으로 표시
      setAuthStatus('success')
    } catch (error) {
      setAuthStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              밴드 연동 인증
            </h1>
            <p className="text-text-secondary">
              BandAuto가 밴드에 접근할 수 있도록 권한을 허가해주세요
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-800 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* 인증 상태 */}
          {authStatus === 'success' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-800 text-sm">
                  밴드 인증이 완료되었습니다!
                </span>
              </div>
            </div>
          )}

          {/* 인증 과정 설명 */}
          <div className="mb-6 space-y-3">
            <h3 className="text-lg font-semibold text-text-primary mb-3">
              인증 과정
            </h3>
            <div className="space-y-2 text-sm text-text-secondary">
              <div className="flex items-center">
                <span className="w-6 h-6 bg-primary-color text-white rounded-full flex items-center justify-center text-xs mr-3">
                  1
                </span>
                아래 버튼을 클릭하여 밴드 인증 페이지로 이동
              </div>
              <div className="flex items-center">
                <span className="w-6 h-6 bg-primary-color text-white rounded-full flex items-center justify-center text-xs mr-3">
                  2
                </span>
                네이버 계정으로 로그인
              </div>
              <div className="flex items-center">
                <span className="w-6 h-6 bg-primary-color text-white rounded-full flex items-center justify-center text-xs mr-3">
                  3
                </span>
                BandAuto 앱의 밴드 접근 권한 허가
              </div>
              <div className="flex items-center">
                <span className="w-6 h-6 bg-primary-color text-white rounded-full flex items-center justify-center text-xs mr-3">
                  4
                </span>
                자동으로 다시 이 페이지로 돌아옴
              </div>
            </div>
          </div>

          {/* 인증 버튼 */}
          <div className="space-y-4">
            <button
              onClick={handleAuthClick}
              disabled={loading || !authUrl || authStatus === 'success'}
              className={`
                w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center
                transition-all duration-200
                ${authStatus === 'success' 
                  ? 'bg-green-100 text-green-800 cursor-not-allowed'
                  : loading || !authUrl
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-primary-color text-white hover:bg-primary-hover hover:shadow-lg transform hover:-translate-y-1'
                }
              `}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  인증 URL 생성 중...
                </>
              ) : authStatus === 'success' ? (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  인증 완료
                </>
              ) : (
                <>
                  <ExternalLink className="w-5 h-5 mr-2" />
                  밴드 인증하기
                </>
              )}
            </button>

            {/* 새로고침 버튼 */}
            {error && (
              <button
                onClick={generateAuthUrl}
                className="w-full py-2 px-4 text-text-secondary hover:text-text-primary border border-border rounded-lg hover:bg-surface transition-colors"
              >
                다시 시도
              </button>
            )}
          </div>

          {/* 주의사항 */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              📝 주의사항
            </h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• 팝업 차단이 설정되어 있다면 해제해주세요</li>
              <li>• 인증은 안전한 HTTPS 연결로 진행됩니다</li>
              <li>• 언제든지 네이버 계정에서 앱 연동을 해제할 수 있습니다</li>
            </ul>
          </div>

          {/* 개발자 정보 (개발 환경에서만) */}
          {process.env.NODE_ENV === 'development' && authUrl && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <details>
                <summary className="text-xs text-gray-600 cursor-pointer">
                  개발자 정보 (클릭하여 펼치기)
                </summary>
                <div className="mt-2 text-xs text-gray-500 break-all">
                  <strong>인증 URL:</strong><br />
                  <code className="bg-gray-100 px-1 rounded">{authUrl}</code>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}