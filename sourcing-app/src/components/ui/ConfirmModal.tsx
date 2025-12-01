'use client'

import { ReactNode } from 'react'
import { AlertTriangle, Trash2, Info, HelpCircle } from 'lucide-react'
import Modal, { ModalFooter } from './Modal'
import Button from './Button'

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
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    buttonVariant: 'danger' as const,
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    buttonVariant: 'primary' as const,
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    buttonVariant: 'primary' as const,
  },
  default: {
    icon: HelpCircle,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    buttonVariant: 'primary' as const,
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

  const handleConfirm = () => {
    onConfirm()
    if (!isLoading) {
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" closeOnOverlay={!isLoading}>
      <div className="flex flex-col items-center text-center py-4">
        <div className={`w-16 h-16 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}>
          <Icon size={32} className={config.iconColor} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <div className="text-gray-600 text-sm">{message}</div>
      </div>
      <ModalFooter className="justify-center border-t-0 mt-2">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={isLoading}
        >
          {cancelText}
        </Button>
        <Button
          variant={config.buttonVariant}
          onClick={handleConfirm}
          loading={isLoading}
        >
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
