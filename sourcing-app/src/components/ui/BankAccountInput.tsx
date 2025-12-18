'use client'

import { useState, useEffect, useCallback } from 'react'
import Select from './Select'
import Input from './Input'
import { BANKS, getBankByCode, formatAccountNumber, getAccountNumberDigits } from '@/constants/banks'

interface BankAccountInputProps {
  bankCode: string
  accountNumber: string
  accountHolder: string
  onBankCodeChange: (value: string) => void
  onAccountNumberChange: (value: string) => void
  onAccountHolderChange: (value: string) => void
  disabled?: boolean
  showLabels?: boolean
}

export default function BankAccountInput({
  bankCode,
  accountNumber,
  accountHolder,
  onBankCodeChange,
  onAccountNumberChange,
  onAccountHolderChange,
  disabled = false,
  showLabels = true,
}: BankAccountInputProps) {
  const [displayValue, setDisplayValue] = useState('')

  const bankOptions = BANKS.map(bank => ({
    value: bank.code,
    label: bank.name,
  }))

  const selectedBank = getBankByCode(bankCode)

  // 계좌번호 포맷팅 및 표시
  useEffect(() => {
    if (accountNumber && bankCode) {
      const formatted = formatAccountNumber(accountNumber, bankCode)
      setDisplayValue(formatted)
    } else {
      setDisplayValue(accountNumber || '')
    }
  }, [accountNumber, bankCode])

  const handleBankChange = (value: string) => {
    onBankCodeChange(value)
    // 은행 변경 시 계좌번호 재포맷팅
    if (accountNumber) {
      const digits = getAccountNumberDigits(accountNumber)
      const formatted = formatAccountNumber(digits, value)
      setDisplayValue(formatted)
      onAccountNumberChange(digits)
    }
  }

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    const digits = getAccountNumberDigits(inputValue)

    // 최대 자릿수 제한
    const maxLength = selectedBank?.length || 14
    const limitedDigits = digits.slice(0, maxLength)

    // 숫자만 저장하고 포맷팅된 값 표시
    onAccountNumberChange(limitedDigits)

    if (bankCode) {
      const formatted = formatAccountNumber(limitedDigits, bankCode)
      setDisplayValue(formatted)
    } else {
      setDisplayValue(limitedDigits)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          {showLabels && (
            <label className="block text-sm font-medium text-gray-500 mb-1">
              은행명
            </label>
          )}
          <Select
            value={bankCode}
            onChange={handleBankChange}
            options={bankOptions}
            placeholder="은행 선택"
            disabled={disabled}
          />
        </div>
        <div>
          {showLabels && (
            <label className="block text-sm font-medium text-gray-500 mb-1">
              계좌번호
            </label>
          )}
          <Input
            value={displayValue}
            onChange={handleAccountNumberChange}
            placeholder={selectedBank?.placeholder || '계좌번호 입력'}
            disabled={disabled || !bankCode}
          />
          {selectedBank && bankCode && (
            <p className="text-xs text-gray-400 mt-1">
              형식: {selectedBank.format} ({selectedBank.length}자리)
            </p>
          )}
        </div>
        <div>
          {showLabels && (
            <label className="block text-sm font-medium text-gray-500 mb-1">
              예금주
            </label>
          )}
          <Input
            value={accountHolder}
            onChange={(e) => onAccountHolderChange(e.target.value)}
            placeholder="예금주명"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
