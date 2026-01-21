import { SelectHTMLAttributes, forwardRef, useId, memo, useCallback } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  options: SelectOption[]
  placeholder?: string
  onChange?: (value: string) => void
}

const Select = memo(forwardRef<HTMLSelectElement, SelectProps>(
  ({
    className = '',
    label,
    error,
    helperText,
    fullWidth = true,
    options,
    placeholder,
    onChange,
    value,
    ...props
  }, ref) => {
    const generatedId = useId()
    const selectId = generatedId
    const widthClass = fullWidth ? 'w-full' : ''
    const errorClass = error ? 'border-error focus:ring-error' : 'border-border focus:ring-primary-color'

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value)
    }, [onChange])

    return (
      <div className={`${widthClass} ${className}`}>
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-text-primary mb-1.5 sm:mb-2">
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            value={value}
            onChange={handleChange}
            className={`
              ${widthClass}
              px-3
              min-h-[44px]
              sm:min-h-[40px]
              py-2.5
              sm:py-2
              pr-10
              border
              ${errorClass}
              rounded-md
              text-base
              sm:text-sm
              focus:outline-none
              focus:ring-2
              focus:border-transparent
              disabled:bg-gray-50
              disabled:cursor-not-allowed
              appearance-none
              bg-white
              cursor-pointer
              ${!value ? 'text-text-muted' : ''}
            `}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            {error ? (
              <AlertCircle size={20} className="text-error" />
            ) : (
              <ChevronDown size={20} className="text-text-muted" />
            )}
          </div>
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

Select.displayName = 'Select'

export default Select
