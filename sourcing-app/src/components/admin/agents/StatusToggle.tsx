'use client'

import { Loader2 } from 'lucide-react'

interface StatusToggleProps {
  status: 'ACTIVE' | 'INACTIVE'
  onToggle: () => void
  disabled?: boolean
  loading?: boolean
}

export default function StatusToggle({
  status,
  onToggle,
  disabled = false,
  loading = false,
}: StatusToggleProps) {
  const isActive = status === 'ACTIVE'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={isActive ? 'Deactivate agent' : 'Activate agent'}
      disabled={disabled || loading}
      onClick={onToggle}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-color
        disabled:opacity-50 disabled:cursor-not-allowed
        ${isActive ? 'bg-green-500' : 'bg-gray-300'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-flex h-5 w-5 items-center justify-center
          rounded-full bg-white shadow-sm ring-0
          transition-transform duration-200 ease-in-out
          ${isActive ? 'translate-x-5' : 'translate-x-0'}
        `}
      >
        {loading && (
          <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
        )}
      </span>
    </button>
  )
}
