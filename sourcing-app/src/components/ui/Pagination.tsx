'use client'

import { memo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationProps) {
  const handlePrevPage = useCallback(() => {
    onPageChange(Math.max(1, currentPage - 1))
  }, [currentPage, onPageChange])

  const handleNextPage = useCallback(() => {
    onPageChange(Math.min(totalPages, currentPage + 1))
  }, [currentPage, totalPages, onPageChange])

  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 sm:px-4 py-3 border-t border-gray-200">
      <p className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
        총 {totalItems.toLocaleString()}건 중 {startItem.toLocaleString()}-{endItem.toLocaleString()}건
      </p>
      <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
        <button
          onClick={handlePrevPage}
          disabled={currentPage === 1}
          aria-label="이전 페이지"
          className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="text-sm text-gray-600 min-w-[70px] sm:min-w-[80px] text-center">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          aria-label="다음 페이지"
          className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
})

export default Pagination
