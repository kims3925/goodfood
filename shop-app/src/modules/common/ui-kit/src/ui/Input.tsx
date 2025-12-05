import { InputHTMLAttributes, forwardRef } from 'react'
import { AlertCircle } from 'lucide-react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className = '', 
    label,
    error,
    helperText,
    fullWidth = true,
    leftIcon,
    rightIcon,
    ...props 
  }, ref) => {
    const widthClass = fullWidth ? 'w-full' : ''
    const errorClass = error ? 'border-error focus:ring-error' : 'border-border focus:ring-primary-color'
    const paddingLeft = leftIcon ? 'pl-10' : 'px-3'
    const paddingRight = rightIcon ? 'pr-10' : 'px-3'
    
    return (
      <div className={`${widthClass} ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-text-primary mb-2">
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            className={`
              ${widthClass}
              ${paddingLeft}
              ${paddingRight}
              py-2
              border
              ${errorClass}
              rounded-md
              focus:outline-none
              focus:ring-2
              focus:border-transparent
              placeholder:text-text-muted
              disabled:bg-gray-50
              disabled:cursor-not-allowed
            `}
            {...props}
          />
          
          {rightIcon && !error && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted">
              {rightIcon}
            </div>
          )}
          
          {error && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-error">
              <AlertCircle size={20} />
            </div>
          )}
        </div>
        
        {(error || helperText) && (
          <p className={`mt-1 text-sm ${error ? 'text-error' : 'text-text-muted'}`}>
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input