import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
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
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm rounded-md',
      md: 'px-4 py-2 text-base rounded-md',
      lg: 'px-6 py-3 text-lg rounded-lg',
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
)

Button.displayName = 'Button'

export default Button