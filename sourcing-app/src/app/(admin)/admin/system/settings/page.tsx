'use client'

import { useState } from 'react'
import { Settings, Save, Server, Globe, Shield, Bell } from 'lucide-react'

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState({
    siteName: 'SNS AUTO',
    siteDescription: 'Band 기반 소셜커머스 자동화 플랫폼',
    adminEmail: 'skkim3925@gmail.com',
    maxShopsPerUser: 5,
    defaultUserRole: 'MANAGER',
    allowPublicRegistration: true,
    maintenanceMode: false,
    autoBackup: true,
    backupSchedule: '0 2 * * *',
    sessionTimeout: 24,
    maxLoginAttempts: 5,
  })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Settings className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">시스템 설정</h1>
              <p className="text-gray-600">플랫폼 전반 설정 관리</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Save size={16} />
            {saved ? '저장됨' : '설정 저장'}
          </button>
        </div>
      </div>

      {/* General */}
      <SettingSection icon={<Globe size={18} />} title="일반 설정">
        <SettingField label="사이트 이름" value={settings.siteName} onChange={(v) => setSettings(s => ({ ...s, siteName: v }))} />
        <SettingField label="사이트 설명" value={settings.siteDescription} onChange={(v) => setSettings(s => ({ ...s, siteDescription: v }))} />
        <SettingField label="관리자 이메일" value={settings.adminEmail} onChange={(v) => setSettings(s => ({ ...s, adminEmail: v }))} />
        <SettingField label="사용자당 최대 쇼핑몰 수" value={String(settings.maxShopsPerUser)} type="number" onChange={(v) => setSettings(s => ({ ...s, maxShopsPerUser: parseInt(v) || 5 }))} />
      </SettingSection>

      {/* Auth */}
      <SettingSection icon={<Shield size={18} />} title="인증/보안">
        <SettingToggle label="공개 회원가입 허용" description="비활성화 시 관리자만 사용자 추가 가능" checked={settings.allowPublicRegistration} onChange={(v) => setSettings(s => ({ ...s, allowPublicRegistration: v }))} />
        <SettingToggle label="유지보수 모드" description="활성화 시 관리자 외 접근 차단" checked={settings.maintenanceMode} onChange={(v) => setSettings(s => ({ ...s, maintenanceMode: v }))} />
        <SettingField label="세션 만료 시간 (시간)" value={String(settings.sessionTimeout)} type="number" onChange={(v) => setSettings(s => ({ ...s, sessionTimeout: parseInt(v) || 24 }))} />
        <SettingField label="최대 로그인 시도 횟수" value={String(settings.maxLoginAttempts)} type="number" onChange={(v) => setSettings(s => ({ ...s, maxLoginAttempts: parseInt(v) || 5 }))} />
      </SettingSection>

      {/* Backup */}
      <SettingSection icon={<Server size={18} />} title="백업">
        <SettingToggle label="자동 백업" description="Cron 스케줄에 따라 DB 자동 백업" checked={settings.autoBackup} onChange={(v) => setSettings(s => ({ ...s, autoBackup: v }))} />
        <SettingField label="백업 스케줄 (Cron)" value={settings.backupSchedule} onChange={(v) => setSettings(s => ({ ...s, backupSchedule: v }))} />
      </SettingSection>
    </div>
  )
}

function SettingSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <span className="text-gray-600">{icon}</span>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function SettingField({ label, value, type = 'text', onChange }: { label: string; value: string; type?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <label className="text-sm font-medium text-gray-700 sm:w-48 flex-shrink-0">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  )
}

function SettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}
