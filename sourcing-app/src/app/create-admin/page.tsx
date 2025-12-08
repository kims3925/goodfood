'use client'

import { useState } from 'react'

export default function CreateAdminPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleCreateAdmin = async () => {
    setStatus('loading')
    try {
      const response = await fetch('/api/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'deca21@naver.com',
          password: 'deca163656',
        }),
      })

      const data = await response.json()

      if (data.success) {
        setStatus('success')
        setMessage('관리자 계정이 생성되었습니다. ID: deca21@naver.com')
      } else {
        setStatus('error')
        setMessage(data.error || '계정 생성에 실패했습니다.')
      }
    } catch (error) {
      setStatus('error')
      setMessage('오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">관리자 계정 생성</h1>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-medium">ID:</span> deca21@naver.com
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Password:</span> deca163656
            </p>
          </div>

          <button
            onClick={handleCreateAdmin}
            disabled={status === 'loading' || status === 'success'}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              status === 'success'
                ? 'bg-green-500 text-white'
                : status === 'loading'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {status === 'loading' ? '생성 중...' : status === 'success' ? '생성 완료' : '관리자 계정 생성'}
          </button>

          {message && (
            <div className={`p-4 rounded-lg text-sm ${
              status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          {status === 'success' && (
            <a
              href="/login"
              className="block w-full py-3 px-4 text-center bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors"
            >
              로그인 페이지로 이동
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
