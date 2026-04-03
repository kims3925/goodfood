'use client'

interface MiniKpiProps {
  current: number
  target: number
  label: string
}

export default function MiniKpi({ current, target, label }: MiniKpiProps) {
  const percentage = target > 0 ? Math.round((current / target) * 100) : 0
  const clampedWidth = Math.min(percentage, 100)

  const getBarColor = () => {
    if (percentage >= 100) return 'bg-green-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getTextColor = () => {
    if (percentage >= 100) return 'text-green-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-secondary truncate">{label}</span>
        <span className={`text-xs font-medium ${getTextColor()}`}>
          {percentage}%
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getBarColor()}`}
          style={{ width: `${clampedWidth}%` }}
        />
      </div>
    </div>
  )
}
