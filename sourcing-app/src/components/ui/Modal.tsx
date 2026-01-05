'use client'

import { Fragment, ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
  closeOnOverlay?: boolean
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
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

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }

  const handleOverlayClick = () => {
    if (closeOnOverlay) {
      onClose()
    }
  }

  return (
    <Fragment>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 fade-in"
        onClick={handleOverlayClick}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`
            bg-white
            rounded-xl
            shadow-xl
            w-full
            ${sizeClasses[size]}
            max-h-[95vh]
            overflow-hidden
            fade-in
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-divider">
              <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          )}

          {/* Content */}
          <div className={`px-6 pt-4 pb-2 overflow-y-auto ${footer ? 'max-h-[calc(95vh-12rem)]' : 'max-h-[calc(95vh-8rem)]'}`}>
            {children}
          </div>

          {/* Footer - 스크롤 영역 외부에 고정 */}
          {footer && (
            <div className="px-6 py-4 border-t border-divider bg-white">
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