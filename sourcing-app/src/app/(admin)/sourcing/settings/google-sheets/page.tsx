'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, TestTube, Check, AlertCircle, FileSpreadsheet, Upload, Trash2, ExternalLink } from 'lucide-react'

interface GoogleSheetSettings {
  spreadsheetId: string
  sheetName: string | null
  isActive: boolean
  hasServiceAccount: boolean
  lastSyncedAt: string | null
}

export default function GoogleSheetsSettingsPage() {
  const [settings, setSettings] = useState<GoogleSheetSettings | null>(null)
  const [serviceAccountJson, setServiceAccountJson] = useState('')
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    spreadsheetTitle?: string
    sheetNames?: string[]
  } | null>(null)
  const [testSuccess, setTestSuccess] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/settings/google-sheets')
      const data = await response.json()

      if (data.success && data.settings) {
        setSettings(data.settings)
        setSpreadsheetId(data.settings.spreadsheetId || '')
        setSheetName(data.settings.sheetName || '')
      }
    } catch (error) {
      console.error('설정 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setServiceAccountJson(content)
      setTestResult(null)
      setTestSuccess(false)
    }
    reader.readAsText(file)
  }

  const testConnection = async () => {
    if (!serviceAccountJson && !settings?.hasServiceAccount) {
      setTestResult({ success: false, message: '서비스 계정 JSON 파일을 업로드해주세요.' })
      return
    }
    if (!spreadsheetId) {
      setTestResult({ success: false, message: '스프레드시트 URL 또는 ID를 입력해주세요.' })
      return
    }

    try {
      setTestResult(null)

      const response = await fetch('/api/settings/google-sheets/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceAccountJson: serviceAccountJson || 'USE_EXISTING',
          spreadsheetId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setTestResult({
          success: true,
          message: data.data.message,
          spreadsheetTitle: data.data.spreadsheetTitle,
          sheetNames: data.data.sheetNames,
        })
        setTestSuccess(true)
      } else {
        setTestResult({ success: false, message: data.error })
        setTestSuccess(false)
      }
    } catch (error) {
      console.error('연결 테스트 실패:', error)
      setTestResult({ success: false, message: '연결 테스트 중 오류가 발생했습니다.' })
      setTestSuccess(false)
    }
  }

  const saveSettings = async () => {
    if (!serviceAccountJson && !settings?.hasServiceAccount) {
      setTestResult({ success: false, message: '서비스 계정 JSON 파일을 업로드해주세요.' })
      return
    }
    if (!spreadsheetId) {
      setTestResult({ success: false, message: '스프레드시트 URL 또는 ID를 입력해주세요.' })
      return
    }

    try {
      setIsSaving(true)

      const response = await fetch('/api/settings/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceAccountJson: serviceAccountJson || 'USE_EXISTING',
          spreadsheetId,
          sheetName: sheetName || null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setTestResult({ success: true, message: '설정이 저장되었습니다.' })
        await loadSettings()
      } else {
        setTestResult({ success: false, message: data.error })
      }
    } catch (error) {
      console.error('설정 저장 실패:', error)
      setTestResult({ success: false, message: '설정 저장 중 오류가 발생했습니다.' })
    } finally {
      setIsSaving(false)
    }
  }

  const deleteSettings = async () => {
    if (!confirm('구글 시트 연동 설정을 삭제하시겠습니까?')) return

    try {
      setIsDeleting(true)

      const response = await fetch('/api/settings/google-sheets', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setSettings(null)
        setServiceAccountJson('')
        setSpreadsheetId('')
        setSheetName('')
        setTestResult({ success: true, message: '설정이 삭제되었습니다.' })
        setTestSuccess(false)
      } else {
        setTestResult({ success: false, message: data.error })
      }
    } catch (error) {
      console.error('설정 삭제 실패:', error)
      setTestResult({ success: false, message: '설정 삭제 중 오류가 발생했습니다.' })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileSpreadsheet className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">구글 시트 설정</h1>
          </div>
          <p className="text-gray-600">발주서를 구글 시트로 자동 동기화합니다.</p>
        </div>

        {/* Settings Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 space-y-6">
            {/* Current Status */}
            {settings?.hasServiceAccount && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">연동 완료</span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p>스프레드시트 ID: {settings.spreadsheetId}</p>
                  {settings.sheetName && <p>시트 이름: {settings.sheetName}</p>}
                  {settings.lastSyncedAt && (
                    <p>마지막 동기화: {new Date(settings.lastSyncedAt).toLocaleString('ko-KR')}</p>
                  )}
                </div>
              </div>
            )}

            {/* Service Account JSON Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                서비스 계정 JSON 파일 *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="json-upload"
                />
                <label htmlFor="json-upload" className="cursor-pointer">
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  {serviceAccountJson ? (
                    <p className="text-sm text-green-600 font-medium">JSON 파일이 로드되었습니다</p>
                  ) : settings?.hasServiceAccount ? (
                    <p className="text-sm text-gray-600">새 JSON 파일로 교체하려면 클릭하세요</p>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Google Cloud에서 다운로드한 JSON 키 파일을 업로드하세요
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    클릭하여 파일 선택
                  </p>
                </label>
              </div>
            </div>

            {/* Spreadsheet URL/ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                구글 스프레드시트 URL 또는 ID *
              </label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => {
                  setSpreadsheetId(e.target.value)
                  setTestSuccess(false)
                }}
                placeholder="https://docs.google.com/spreadsheets/d/... 또는 시트 ID"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                구글 시트 URL 전체 또는 ID만 입력해도 됩니다.
              </p>
            </div>

            {/* Sheet Name (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시트 이름 (선택사항)
              </label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="비워두면 도매처 이름으로 자동 생성됩니다"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Setup Guide */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">설정 가이드</h4>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>Google Cloud Console에서 서비스 계정 JSON 키를 다운로드합니다</li>
                <li>연동할 구글 스프레드시트를 생성합니다</li>
                <li>시트에서 서비스 계정 이메일을 <strong>편집자</strong>로 공유합니다</li>
                <li>위 필드에 정보를 입력하고 연결 테스트를 진행합니다</li>
              </ol>
              <div className="mt-3 flex gap-2">
                <a
                  href="https://console.cloud.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Google Cloud Console
                </a>
                <a
                  href="https://docs.google.com/spreadsheets"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Google Sheets
                </a>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`border rounded-md p-4 ${
                testResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`text-sm font-semibold ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult.success ? '성공' : '실패'}
                  </span>
                </div>
                <p className={`text-sm ${
                  testResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {testResult.message}
                </p>
                {testResult.spreadsheetTitle && (
                  <p className="text-sm text-green-700 mt-1">
                    스프레드시트: {testResult.spreadsheetTitle}
                  </p>
                )}
                {testResult.sheetNames && testResult.sheetNames.length > 0 && (
                  <p className="text-sm text-green-700 mt-1">
                    시트: {testResult.sheetNames.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="border-t pt-6">
              {!testSuccess && (
                <p className="text-xs text-gray-500 text-right mb-2">
                  * 연결 테스트를 먼저 완료해주세요
                </p>
              )}
              <div className="flex justify-between">
                {settings?.hasServiceAccount && (
                  <button
                    onClick={deleteSettings}
                    disabled={isDeleting}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    연동 해제
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={testConnection}
                    className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                  >
                    <TestTube className="h-4 w-4" />
                    연결 테스트
                  </button>
                  <button
                    onClick={saveSettings}
                    disabled={isSaving || !testSuccess}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        설정 저장
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
