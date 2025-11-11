'use client'

import { useState, useEffect } from 'react'
import { Save, Info } from 'lucide-react'

interface AutomationSettings {
  defaultPricingPolicy: string
}

const PRESET_POLICIES = [
  {
    name: '구간별 마진 정책 (기본)',
    value: '수집가격 기준 구간별 마진 적용 (19,900원 이하 +1,000원, 20,000~29,900원 +2,000원, 30,000~39,900원 +3,000원, 40,000~49,900원 +4,000원, 50,000~59,900원 +5,000원, 60,001~70,000원 +6,000원, 70,001~80,000원 +7,000원, 80,001~90,000원 +8,000원, 90,001~100,000원 +9,000원, 100,001~150,000원 +12,000원, 150,001~200,000원 +20,000원, 200,001원 이상 +20,000원)'
  },
  {
    name: '원가 그대로',
    value: '원가 그대로 판매 (단, 39,900원 이상은 구간별 마진 적용: 40,000~49,900원 +2,000원, 50,000~59,900원 +4,000원, 60,001~70,000원 +6,000원, 70,001~80,000원 +7,000원, 80,001~90,000원 +8,000원, 90,001~100,000원 +9,000원, 100,001~150,000원 +12,000원, 150,001~200,000원 +20,000원)'
  },
  {
    name: '공급가 기준 마진',
    value: '공급가와 배송비를 분리, 공급가에만 마진 적용 (19,900원까지 +4,000원, 19,900원 초과 시 1만원 구간마다 +1,000원 추가)'
  },
  {
    name: '30% 마진',
    value: '30% 마진 적용'
  },
  {
    name: '+5,000원 고정 마진',
    value: '+5000원 고정 마진'
  }
]

export default function AutomationSettingsPage() {
  const [settings, setSettings] = useState<AutomationSettings>({
    defaultPricingPolicy: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/automation')
      const data = await response.json()

      if (data.success) {
        setSettings(data.settings)
      } else {
        setMessage('설정을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      setMessage('설정을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      const data = await response.json()

      if (data.success) {
        setMessage('✅ 설정이 저장되었습니다.')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('❌ ' + (data.error || '설정 저장에 실패했습니다.'))
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage('❌ 설정 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handlePresetSelect = (presetValue: string) => {
    setSettings(prev => ({
      ...prev,
      defaultPricingPolicy: presetValue
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-color mx-auto"></div>
          <p className="mt-4 text-text-secondary">설정 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">자동화 설정</h1>
          <p className="text-text-secondary">
            게시물 수집 및 가격 계산 자동화 설정을 관리합니다.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('✅')
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        {/* Settings Card */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-6 mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-4">기본 가격정책</h2>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-2">기본 가격정책이란?</p>
                <p className="mb-2">
                  도매 밴드에 가격정책이 설정되지 않았거나 공백인 경우,
                  이 기본 가격정책이 자동으로 적용됩니다.
                </p>
                <p>
                  각 도매 밴드마다 고유한 가격정책을 설정할 수 있으며,
                  설정이 없는 밴드에만 이 기본 정책이 사용됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Preset Policies */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-text-primary mb-3">
              프리셋 정책 선택
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRESET_POLICIES.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => handlePresetSelect(preset.value)}
                  className={`p-4 text-left rounded-lg border-2 transition-all ${
                    settings.defaultPricingPolicy === preset.value
                      ? 'border-primary-color bg-primary-light'
                      : 'border-gray-200 hover:border-primary-color hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-text-primary mb-1">{preset.name}</div>
                  <div className="text-xs text-text-secondary line-clamp-2">{preset.value}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Policy Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-text-primary mb-2">
              커스텀 가격정책
            </label>
            <textarea
              value={settings.defaultPricingPolicy}
              onChange={(e) => setSettings({ ...settings, defaultPricingPolicy: e.target.value })}
              placeholder="가격정책을 입력하세요. 예: 수집가격 기준 구간별 마진 적용 (...)"
              className="w-full px-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-primary-color focus:border-transparent min-h-[120px] font-mono text-sm"
            />
            <p className="mt-2 text-xs text-text-secondary">
              정책 예시: "30% 마진 적용", "+5000원 고정 마진", "원가 그대로" 등
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-primary-color text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={20} />
              {saving ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        </div>

        {/* Policy Examples */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-xl font-semibold text-text-primary mb-4">정책 작성 가이드</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-text-primary mb-2">1. 구간별 마진</h3>
              <code className="block bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                수집가격 기준 구간별 마진 적용 (19,900원 이하 +1,000원, 20,000~29,900원 +2,000원, ...)
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-text-primary mb-2">2. 퍼센트 마진</h3>
              <code className="block bg-gray-50 p-3 rounded text-sm">
                30% 마진 적용
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-text-primary mb-2">3. 고정 마진</h3>
              <code className="block bg-gray-50 p-3 rounded text-sm">
                +5000원 고정 마진
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-text-primary mb-2">4. 원가 그대로</h3>
              <code className="block bg-gray-50 p-3 rounded text-sm">
                원가 그대로
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-text-primary mb-2">5. 최소 마진</h3>
              <code className="block bg-gray-50 p-3 rounded text-sm">
                최소 마진 3000원
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
