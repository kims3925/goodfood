/**
 * Product Variant Generator
 *
 * Generates all possible variant combinations from option groups using Cartesian product
 */

import { OptionGroup, GeneratedVariant } from './product.types'

/**
 * Generate all possible variant combinations from option groups
 *
 * @param optionGroups - Array of option groups with their values
 * @returns Array of generated variants with all possible combinations
 *
 * @example
 * ```typescript
 * const options = [
 *   { groupName: "색상", values: ["빨강", "파랑"] },
 *   { groupName: "사이즈", values: ["S", "M", "L"] }
 * ]
 * const variants = generateVariants(options)
 * // Result: 6 variants (2 colors × 3 sizes)
 * // [
 * //   { optionSummary: "색상:빨강, 사이즈:S", options: { "색상": "빨강", "사이즈": "S" } },
 * //   { optionSummary: "색상:빨강, 사이즈:M", options: { "색상": "빨강", "사이즈": "M" } },
 * //   ...
 * // ]
 * ```
 */
export function generateVariants(optionGroups: OptionGroup[]): GeneratedVariant[] {
  // Handle edge cases
  if (!optionGroups || optionGroups.length === 0) {
    return []
  }

  // Filter out empty option groups
  const validGroups = optionGroups.filter(
    (group) => group.values && group.values.length > 0
  )

  if (validGroups.length === 0) {
    return []
  }

  // Calculate cartesian product
  const combinations = cartesianProduct(
    validGroups.map((group) => group.values)
  )

  // Map combinations to variants
  return combinations.map((combination) => {
    const options: Record<string, string> = {}
    const summaryParts: string[] = []

    validGroups.forEach((group, index) => {
      const value = combination[index]
      options[group.groupName] = value
      summaryParts.push(`${group.groupName}:${value}`)
    })

    return {
      optionSummary: summaryParts.join(', '),
      options,
    }
  })
}

/**
 * Calculate Cartesian product of arrays
 *
 * @param arrays - Array of arrays to calculate product
 * @returns Array of all possible combinations
 *
 * @example
 * ```typescript
 * cartesianProduct([["A", "B"], ["1", "2"]])
 * // Returns: [["A", "1"], ["A", "2"], ["B", "1"], ["B", "2"]]
 * ```
 */
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return []
  if (arrays.length === 1) return arrays[0].map((item) => [item])

  return arrays.reduce<T[][]>(
    (acc, curr) => {
      const result: T[][] = []
      acc.forEach((accItem) => {
        curr.forEach((currItem) => {
          result.push([...accItem, currItem])
        })
      })
      return result
    },
    [[]] as T[][]
  )
}

/**
 * Format option summary string from options object
 *
 * @param options - Options object
 * @returns Formatted option summary string
 *
 * @example
 * ```typescript
 * formatOptionSummary({ "색상": "빨강", "사이즈": "L" })
 * // Returns: "색상:빨강, 사이즈:L"
 * ```
 */
export function formatOptionSummary(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([key, value]) => `${key}:${value}`)
    .join(', ')
}

/**
 * Parse option summary string to options object
 *
 * @param summary - Option summary string
 * @returns Options object
 *
 * @example
 * ```typescript
 * parseOptionSummary("색상:빨강, 사이즈:L")
 * // Returns: { "색상": "빨강", "사이즈": "L" }
 * ```
 */
export function parseOptionSummary(summary: string): Record<string, string> {
  const options: Record<string, string> = {}

  if (!summary || summary.trim() === '') {
    return options
  }

  summary.split(',').forEach((part) => {
    const [key, value] = part.split(':').map((s) => s.trim())
    if (key && value) {
      options[key] = value
    }
  })

  return options
}

/**
 * Validate option groups structure
 *
 * @param optionGroups - Option groups to validate
 * @returns Validation result with errors if any
 */
export function validateOptionGroups(optionGroups: OptionGroup[]): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!Array.isArray(optionGroups)) {
    errors.push('Option groups must be an array')
    return { valid: false, errors }
  }

  optionGroups.forEach((group, index) => {
    if (!group.groupName || group.groupName.trim() === '') {
      errors.push(`Option group at index ${index} must have a groupName`)
    }

    if (!Array.isArray(group.values)) {
      errors.push(`Option group "${group.groupName}" values must be an array`)
    } else if (group.values.length === 0) {
      errors.push(`Option group "${group.groupName}" must have at least one value`)
    }

    // Check for duplicate values within a group
    const uniqueValues = new Set(group.values)
    if (uniqueValues.size !== group.values.length) {
      errors.push(`Option group "${group.groupName}" has duplicate values`)
    }
  })

  // Check for duplicate group names
  const groupNames = optionGroups.map((g) => g.groupName)
  const uniqueGroupNames = new Set(groupNames)
  if (uniqueGroupNames.size !== groupNames.length) {
    errors.push('Duplicate option group names found')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Calculate total number of variants that will be generated
 *
 * @param optionGroups - Option groups
 * @returns Total number of variant combinations
 */
export function calculateVariantCount(optionGroups: OptionGroup[]): number {
  if (!optionGroups || optionGroups.length === 0) {
    return 0
  }

  return optionGroups.reduce((count, group) => {
    return count * (group.values?.length || 0)
  }, 1)
}
