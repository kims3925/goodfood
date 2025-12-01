'use client'

import { useToast } from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import { CheckCircle, XCircle, Info, AlertTriangle, Zap } from 'lucide-react'

export default function ToastTestPage() {
  const toast = useToast()

  // 개별 토스트 테스트
  const showSuccess = () => {
    toast.success('저장이 완료되었습니다.')
  }

  const showError = () => {
    toast.error('요청 처리 중 오류가 발생했습니다.')
  }

  const showInfo = () => {
    toast.info('새로운 업데이트가 있습니다.')
  }

  const showWarning = () => {
    toast.warning('저장하지 않은 변경사항이 있습니다.')
  }

  // 다중 토스트 테스트
  const showMultiple = () => {
    toast.success('1단계: 데이터 검증 완료')
    setTimeout(() => toast.info('2단계: 서버 전송 중...'), 300)
    setTimeout(() => toast.success('3단계: 저장 완료!'), 600)
  }

  // 실제 사용 시나리오 예시
  const simulateSave = async () => {
    toast.info('저장 중...')
    await new Promise(resolve => setTimeout(resolve, 1500))
    toast.success('밴드 정보가 저장되었습니다.')
  }

  const simulateError = async () => {
    toast.info('요청 처리 중...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    toast.error('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
  }

  const simulateDelete = () => {
    toast.warning('삭제된 항목은 복구할 수 없습니다.')
    setTimeout(() => toast.success('항목이 삭제되었습니다.'), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Toast 컴포넌트 테스트</h1>
        <p className="mt-2 text-text-secondary">
          다양한 Toast 알림을 테스트해보세요. 우측 상단에 토스트가 나타납니다.
        </p>
      </div>

      {/* 기본 토스트 타입 */}
      <div className="bg-white border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">기본 Toast 타입</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Button onClick={showSuccess} variant="primary">
            <CheckCircle size={16} className="mr-2" />
            Success
          </Button>
          <Button onClick={showError} variant="danger">
            <XCircle size={16} className="mr-2" />
            Error
          </Button>
          <Button onClick={showInfo} variant="secondary">
            <Info size={16} className="mr-2" />
            Info
          </Button>
          <Button onClick={showWarning} variant="ghost" className="border border-yellow-500 text-yellow-600 hover:bg-yellow-50">
            <AlertTriangle size={16} className="mr-2" />
            Warning
          </Button>
        </div>
      </div>

      {/* 다중 토스트 */}
      <div className="bg-white border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">다중 Toast 스택</h2>
        <p className="text-sm text-text-secondary mb-4">
          여러 개의 토스트가 동시에 쌓이는 것을 확인합니다.
        </p>
        <Button onClick={showMultiple} variant="primary">
          <Zap size={16} className="mr-2" />
          3개 동시 표시
        </Button>
      </div>

      {/* 실제 시나리오 */}
      <div className="bg-white border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">실제 사용 시나리오</h2>
        <p className="text-sm text-text-secondary mb-4">
          실제 앱에서 사용되는 패턴을 시뮬레이션합니다.
        </p>
        <div className="flex flex-wrap gap-4">
          <Button onClick={simulateSave} variant="primary">
            저장 시뮬레이션
          </Button>
          <Button onClick={simulateError} variant="danger">
            에러 시뮬레이션
          </Button>
          <Button onClick={simulateDelete} variant="ghost" className="border border-border">
            삭제 시뮬레이션
          </Button>
        </div>
      </div>

      {/* 사용법 코드 예시 */}
      <div className="bg-white border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">사용법</h2>
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm">
{`// 1. useToast 훅 import
import { useToast } from '@/components/ui/Toast'

// 2. 컴포넌트 내에서 사용
function MyComponent() {
  const toast = useToast()

  const handleSave = async () => {
    try {
      await saveData()
      toast.success('저장되었습니다.')  // ✅ alert() 대체
    } catch (error) {
      toast.error('저장에 실패했습니다.')  // ✅ alert() 대체
    }
  }

  return <button onClick={handleSave}>저장</button>
}`}
          </pre>
        </div>
      </div>

      {/* 기존 alert vs Toast 비교 */}
      <div className="bg-white border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">alert() vs Toast 비교</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-red-200 bg-red-50 rounded-lg p-4">
            <h3 className="font-medium text-red-800 mb-2">❌ 기존 방식 (alert)</h3>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• 브라우저 기본 UI (촌스러움)</li>
              <li>• 사용자 확인 필수 (작업 중단)</li>
              <li>• 커스터마이징 불가</li>
              <li>• 스타일 일관성 없음</li>
            </ul>
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="border border-red-300 text-red-600"
                onClick={() => alert('이것은 브라우저 기본 alert입니다.')}
              >
                alert() 테스트
              </Button>
            </div>
          </div>
          <div className="border border-green-200 bg-green-50 rounded-lg p-4">
            <h3 className="font-medium text-green-800 mb-2">✅ 개선 방식 (Toast)</h3>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• 디자인 시스템과 일관된 UI</li>
              <li>• 자동 사라짐 (작업 방해 없음)</li>
              <li>• 타입별 아이콘/색상</li>
              <li>• 다중 알림 지원</li>
            </ul>
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="border border-green-300 text-green-600"
                onClick={() => toast.success('이것은 Toast 알림입니다.')}
              >
                Toast 테스트
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
