'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 rounded-full">
            <AlertTriangle className="text-error" size={48} />
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-text-primary mb-4">
          오류가 발생했습니다
        </h2>
        
        <p className="text-text-secondary mb-8 max-w-md mx-auto">
          예기치 않은 오류가 발생했습니다. 
          문제가 계속되면 고객 지원팀에 문의해주세요.
        </p>
        
        <div className="flex gap-4 justify-center">
          <Button
            variant="secondary"
            onClick={() => reset()}
          >
            <RefreshCw size={20} className="mr-2" />
            다시 시도
          </Button>
          
          <Button
            onClick={() => window.location.href = '/dashboard'}
          >
            <Home size={20} className="mr-2" />
            대시보드로 이동
          </Button>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-8 text-left max-w-2xl mx-auto">
            <summary className="cursor-pointer text-text-muted hover:text-text-secondary">
              오류 상세 정보 (개발 모드)
            </summary>
            <pre className="mt-4 p-4 bg-gray-100 rounded-lg text-xs overflow-auto">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}