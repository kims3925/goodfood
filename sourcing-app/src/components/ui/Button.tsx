import { ButtonHTMLAttributes, forwardRef, memo } from 'react'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className = '',
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    disabled,
    children,
    ...props
  }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const variantClasses = {
      primary: 'bg-primary-color text-white hover:bg-primary-hover focus:ring-primary-color',
      secondary: 'bg-white text-primary-color border border-primary-color hover:bg-primary-light focus:ring-primary-color',
      ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface focus:ring-gray-500',
      danger: 'bg-error text-white hover:bg-red-600 focus:ring-error',
    }

    // 모바일 터치 타겟 44px 이상 보장
    const sizeClasses = {
      sm: 'min-h-[44px] sm:min-h-[36px] px-3 py-2 sm:py-1.5 text-sm rounded-md',
      md: 'min-h-[44px] sm:min-h-[40px] px-4 py-2.5 sm:py-2 text-base rounded-md',
      lg: 'min-h-[48px] sm:min-h-[44px] px-6 py-3 text-lg rounded-lg',
    }

    const widthClass = fullWidth ? 'w-full' : ''

    return (
      <button
        ref={ref}
        className={`
          ${baseClasses}
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${widthClass}
          ${className}
        `}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {children}
      </button>
    )
  }
))

Button.displayName = 'Button'

export default Button