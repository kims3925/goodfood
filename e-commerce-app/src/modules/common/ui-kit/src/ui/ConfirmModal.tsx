'use client'

import { ReactNode, useEffect } from 'react'
import { AlertTriangle, Trash2, Info, HelpCircle } from 'lucide-react'

type ConfirmVariant = 'danger' | 'warning' | 'info' | 'default'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string | ReactNode
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
  isLoading?: boolean
}

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBgColor: '#FEE2E2',
    iconColor: '#DC2626',
    buttonBgColor: '#DC2626',
    buttonHoverColor: '#B91C1C',
  },
  warning: {
    icon: AlertTriangle,
    iconBgColor: '#FEF3C7',
    iconColor: '#D97706',
    buttonBgColor: '#D97706',
    buttonHoverColor: '#B45309',
  },
  info: {
    icon: Info,
    iconBgColor: '#DBEAFE',
    iconColor: '#2563EB',
    buttonBgColor: '#2563EB',
    buttonHoverColor: '#1D4ED8',
  },
  default: {
    icon: HelpCircle,
    iconBgColor: '#F3F4F6',
    iconColor: '#4B5563',
    buttonBgColor: '#2563EB',
    buttonHoverColor: '#1D4ED8',
  },
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'default',
  isLoading = false,
}: ConfirmModalProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, isLoading, onClose])

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    if (!isLoading) {
      onClose()
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleOverlayClick}
    >
      <div
        className="relative bg-white rounded-2xl shadow-xl"
        style={{ width: '280px', maxWidth: 'calc(100% - 32px)' }}
      >
        {/* Content */}
        <div className="flex flex-col items-center text-center p-5 pb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: config.iconBgColor }}
          >
            <Icon size={24} style={{ color: config.iconColor }} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
          <div className="text-gray-500 text-sm">{message}</div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#F3F4F6' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E5E7EB'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer text-white"
            style={{ backgroundColor: config.buttonBgColor }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = config.buttonHoverColor}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = config.buttonBgColor}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                처리 중...
              </span>
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
