import { InputHTMLAttributes, forwardRef, useId, memo } from 'react'
import { AlertCircle } from 'lucide-react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = memo(forwardRef<HTMLInputElement, InputProps>(
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
    const generatedId = useId()
    const inputId = generatedId
    const widthClass = fullWidth ? 'w-full' : ''
    const errorClass = error ? 'border-error focus:ring-error' : 'border-border focus:ring-primary-color'
    const paddingLeft = leftIcon ? 'pl-10 sm:pl-10' : 'px-3'
    const paddingRight = rightIcon ? 'pr-10 sm:pr-10' : 'px-3'

    return (
      <div className={`${widthClass} ${className}`}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-text-primary mb-1.5 sm:mb-2">
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
            id={inputId}
            className={`
              ${widthClass}
              ${paddingLeft}
              ${paddingRight}
              min-h-[44px]
              sm:min-h-[40px]
              py-2.5
              sm:py-2
              border
              ${errorClass}
              rounded-md
              text-base
              sm:text-sm
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
))

Input.displayName = 'Input'

export default Input