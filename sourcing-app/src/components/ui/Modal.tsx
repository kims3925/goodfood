'use client'

import { Fragment, ReactNode, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
  closeOnOverlay?: boolean
  /** 모바일에서 전체 화면으로 표시 */
  fullScreenOnMobile?: boolean
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  fullScreenOnMobile = false,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleOverlayClick = useCallback(() => {
    if (closeOnOverlay) {
      onClose()
    }
  }, [closeOnOverlay, onClose])

  if (!isOpen) return null

  // 모바일: 화면 너비에 맞춤, 데스크톱: 기존 max-w 적용
  const sizeClasses = {
    sm: 'max-w-[calc(100vw-2rem)] sm:max-w-sm',
    md: 'max-w-[calc(100vw-2rem)] sm:max-w-md',
    lg: 'max-w-[calc(100vw-2rem)] sm:max-w-lg',
    xl: 'max-w-[calc(100vw-2rem)] sm:max-w-xl',
    '2xl': 'max-w-[calc(100vw-2rem)] sm:max-w-2xl',
    '3xl': 'max-w-[calc(100vw-2rem)] md:max-w-3xl',
    '4xl': 'max-w-[calc(100vw-2rem)] md:max-w-4xl',
  }

  // 모바일 전체화면 모드
  const fullScreenMobileClass = fullScreenOnMobile
    ? 'sm:rounded-xl sm:max-h-[90vh] max-h-full h-full sm:h-auto rounded-none'
    : 'rounded-xl max-h-[90vh] sm:max-h-[95vh]'

  return (
    <Fragment>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 fade-in"
        onClick={handleOverlayClick}
      />

      {/* Modal */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${fullScreenOnMobile ? 'p-0 sm:p-4' : 'p-2 sm:p-4'}`}>
        <div
          className={`
            bg-white
            shadow-xl
            w-full
            ${sizeClasses[size]}
            ${fullScreenMobileClass}
            overflow-hidden
            fade-in
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-divider">
              <h2 className="text-lg sm:text-xl font-semibold text-text-primary pr-2">{title}</h2>
              <button
                onClick={onClose}
                aria-label="닫기"
                className="flex items-center justify-center min-w-[44px] min-h-[44px] -mr-2 rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Content */}
          <div className={`px-4 sm:px-6 pt-4 pb-2 overflow-y-auto ${footer ? 'max-h-[calc(90vh-12rem)] sm:max-h-[calc(95vh-12rem)]' : 'max-h-[calc(90vh-8rem)] sm:max-h-[calc(95vh-8rem)]'} ${fullScreenOnMobile ? 'max-h-[calc(100vh-8rem)] sm:max-h-[calc(90vh-8rem)]' : ''}`}>
            {children}
          </div>

          {/* Footer - 스크롤 영역 외부에 고정 */}
          {footer && (
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-divider bg-white">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Fragment>
  )
}

// Modal Footer Component
export function ModalFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-end gap-3 pt-4 mt-4 border-t border-divider ${className}`}>
      {children}
    </div>
  )
}