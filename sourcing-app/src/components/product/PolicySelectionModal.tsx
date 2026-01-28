'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollText, Check, Sparkles, CircleOff, Settings } from 'lucide-react'
import Modal, { ModalFooter } from '../ui/Modal'
import Button from '../ui/Button'
import Loading from '../ui/Loading'

interface PricingPolicy {
  id: number
  name: string
  description: string | null
  content: string
  isActive: boolean
}

interface PolicySelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onPolicySelected: (policyId: number | null, policyContent: string | null) => void
  selectedPostCount: number
}

export default function PolicySelectionModal({
  isOpen,
  onClose,
  onPolicySelected,
  selectedPostCount,
}: PolicySelectionModalProps) {
  const router = useRouter()
  const [policies, setPolicies] = useState<PricingPolicy[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null)
  const [skipPolicy, setSkipPolicy] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadPolicies()
      setSelectedPolicyId(null)
      setSkipPolicy(false)
    }
  }, [isOpen])

  const loadPolicies = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/policy')
      const data = await response.json()

      if (data.success) {
        // 활성화된 정책만 필터링
        const activePolicies = data.data.filter((p: PricingPolicy) => p.isActive)
        setPolicies(activePolicies)
      }
    } catch (error) {
      console.error('정책 목록 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePolicyClick = (policy: PricingPolicy) => {
    setSelectedPolicyId(policy.id)
    setSkipPolicy(false)
  }

  const handleSkipPolicy = () => {
    setSkipPolicy(true)
    setSelectedPolicyId(null)
  }

  const handleConfirm = () => {
    if (skipPolicy) {
      onPolicySelected(null, null)
    } else if (selectedPolicyId) {
      const selectedPolicy = policies.find(p => p.id === selectedPolicyId)
      onPolicySelected(selectedPolicyId, selectedPolicy?.content || null)
    }
  }

  const isConfirmDisabled = !skipPolicy && !selectedPolicyId

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="가격 정책 선택"
      size="2xl"
    >
      {isLoading ? (
        <div className="py-12">
          <Loading />
          <p className="text-center text-gray-600 mt-4">정책을 불러오는 중...</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* 안내 메시지 */}
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-800">
              <Sparkles className="inline-block w-4 h-4 mr-1" />
              AI가 상품 가격을 계산할 때 참조할 정책을 선택하세요.
              <strong className="ml-1">{selectedPostCount}개 게시물</strong>이 선택되었습니다.
            </p>
          </div>

          {/* 정책 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* 정책 없이 진행 카드 - 첫 번째 */}
            <button
              onClick={handleSkipPolicy}
              className={`
                p-4 border-2 rounded-lg transition-all text-left flex flex-col min-h-[120px]
                ${skipPolicy
                  ? 'border-gray-500 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CircleOff className={`h-5 w-5 ${skipPolicy ? 'text-gray-600' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-900">정책 없이 진행</span>
                </div>
                {skipPolicy && (
                  <Check className="h-5 w-5 text-gray-600" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-1">
                AI 기본 로직을 사용하여 상품 정보를 추출합니다.
              </p>
              <p className="text-xs text-gray-500">
                가격 정책 없이 도매가만 추출됩니다.
              </p>
            </button>

            {/* 정책 카드들 */}
            {policies.map((policy) => {
              const isSelected = selectedPolicyId === policy.id
              return (
                <button
                  key={policy.id}
                  onClick={() => handlePolicyClick(policy)}
                  className={`
                    p-4 border-2 rounded-lg transition-all text-left flex flex-col min-h-[120px]
                    ${isSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ScrollText className={`h-5 w-5 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
                      <span className="font-semibold text-gray-900">{policy.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-purple-600" />
                    )}
                  </div>
                  {policy.description && (
                    <p className="text-sm text-gray-600 mb-1 line-clamp-2">
                      {policy.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 line-clamp-3">
                    {policy.content}
                  </p>
                </button>
              )
            })}
          </div>

          {/* 정책 설정 페이지 이동 버튼 */}
          <div className="border-t border-gray-200 pt-4 mb-4">
            <button
              onClick={() => {
                onClose()
                router.push('/policy/list')
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
            >
              <Settings size={16} />
              정책 설정 페이지로 이동
            </button>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
            >
              <Sparkles size={16} />
              AI 변환 시작
            </Button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  )
}
