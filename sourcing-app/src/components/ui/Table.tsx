import { TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, forwardRef, memo } from 'react'

interface TableWrapperProps extends TableHTMLAttributes<HTMLTableElement> {
  /** 모바일에서 최소 너비 지정 (스크롤 유도) */
  minWidth?: string
}

export const Table = memo(forwardRef<HTMLTableElement, TableWrapperProps>(
  ({ className = '', children, minWidth, ...props }, ref) => {
    return (
      <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table
          ref={ref}
          className={`w-full border-collapse ${minWidth ? minWidth : 'min-w-[600px] sm:min-w-0'} ${className}`}
          {...props}
        >
          {children}
        </table>
      </div>
    )
  }
))

Table.displayName = 'Table'

export const TableHeader = memo(forwardRef<HTMLTableSectionElement, TableHTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={`bg-surface border-b border-border ${className}`}
        {...props}
      >
        {children}
      </thead>
    )
  }
))

TableHeader.displayName = 'TableHeader'

export const TableBody = memo(forwardRef<HTMLTableSectionElement, TableHTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={`divide-y divide-border ${className}`}
        {...props}
      >
        {children}
      </tbody>
    )
  }
))

TableBody.displayName = 'TableBody'

export const TableRow = memo(forwardRef<HTMLTableRowElement, TableHTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={`hover:bg-surface transition-colors ${className}`}
        {...props}
      >
        {children}
      </tr>
    )
  }
))

TableRow.displayName = 'TableRow'

export const TableHead = memo(forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={`px-2 py-2 sm:px-4 sm:py-3 text-left text-xs sm:text-sm font-medium text-text-primary whitespace-nowrap ${className}`}
        {...props}
      >
        {children}
      </th>
    )
  }
))

TableHead.displayName = 'TableHead'

export const TableCell = memo(forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={`px-2 py-2 sm:px-4 sm:py-3 text-left text-xs sm:text-sm text-text-secondary ${className}`}
        {...props}
      >
        {children}
      </td>
    )
  }
))

TableCell.displayName = 'TableCell'

// Empty State Component
export function TableEmpty({ message = '데이터가 없습니다.' }: { message?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={100} className="text-center py-8 text-text-muted">
        {message}
      </TableCell>
    </TableRow>
  )
}