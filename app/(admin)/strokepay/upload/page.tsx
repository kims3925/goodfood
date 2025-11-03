'use client'

import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw, ExternalLink, Copy, Globe } from 'lucide-react'

export default function StrokePayUploadPage() {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed'>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<any>(null)
  const [isAutoMode, setIsAutoMode] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 파일 유효성 검사
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('엑셀 파일만 업로드 가능합니다.')
        return
      }
      
      setSelectedFile(file)
      setUploadStatus('idle')
      setUploadResults(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file)
      setUploadStatus('idle')
      setUploadResults(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploadStatus('uploading')
    setUploadProgress(0)

    // 파일 업로드를 위한 FormData 생성
    const formData = new FormData()
    formData.append('file', selectedFile)

    // Progress 시뮬레이션
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 500)

    try {
      // 먼저 파일을 서버에 업로드
      const uploadResponse = await fetch('/api/upload/excel', {
        method: 'POST',
        body: formData
      })

      const uploadData = await uploadResponse.json()
      
      if (!uploadData.success) {
        throw new Error('파일 업로드 실패')
      }

      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadStatus('processing')

      // Playwright를 통한 스룩페이 업로드
      if (isAutoMode) {
        const response = await fetch('/api/strokepay/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            fileName: uploadData.fileName 
          })
        })

        const result = await response.json()

        if (result.success) {
          setUploadStatus('completed')
          setUploadResults(result)
        } else {
          throw new Error(result.error || '업로드 실패')
        }
      } else {
        // 수동 모드: 파일만 준비하고 사용자가 직접 업로드
        setUploadStatus('completed')
        setUploadResults({
          totalProducts: selectedFile.size > 10000 ? 15 : 5,
          successCount: 0,
          failedCount: 0,
          manualMode: true,
          fileName: uploadData.fileName,
          downloadUrl: uploadData.downloadUrl
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      clearInterval(progressInterval)
      setUploadStatus('idle')
      alert('업로드 중 오류가 발생했습니다.')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('링크가 복사되었습니다!')
  }

  const openStrokePay = () => {
    window.open('https://srookpay.com/newsrp/Main/Index', '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Upload className="w-6 h-6 text-blue-600" />
              스룩페이 대량 업로드
            </h1>
            <p className="mt-2 text-gray-600">엑셀 파일을 업로드하여 스룩페이에 대량으로 상품을 등록합니다</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAutoMode}
                onChange={(e) => setIsAutoMode(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">자동 업로드</span>
            </label>
            <button
              onClick={openStrokePay}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              스룩페이 열기
            </button>
          </div>
        </div>
      </div>

      {/* Mode Info */}
      <div className={`border rounded-lg p-4 ${isAutoMode ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isAutoMode ? 'text-blue-600' : 'text-yellow-600'}`} />
          <div className={`text-sm ${isAutoMode ? 'text-blue-900' : 'text-yellow-900'}`}>
            <p className="font-semibold mb-1">
              {isAutoMode ? '자동 업로드 모드' : '수동 업로드 모드'}
            </p>
            <p>
              {isAutoMode 
                ? 'Playwright를 통해 스룩페이에 자동으로 로그인하여 상품을 등록합니다. 스룩페이 계정 정보가 환경 변수에 설정되어 있어야 합니다.'
                : '엑셀 파일을 준비한 후, 스룩페이 사이트에서 직접 업로드해야 합니다. 파일 다운로드 후 스룩페이 > 상품관리 > 대량등록 메뉴를 이용하세요.'}
            </p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">엑셀 파일 업로드</h2>
        
        <div className="space-y-4">
          {/* File Upload Area */}
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">엑셀 파일을 선택하거나 드래그하세요</p>
              <p className="text-sm text-gray-500">지원 형식: .xlsx, .xls (최대 10MB)</p>
              {selectedFile && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg inline-block">
                  <p className="text-sm font-medium text-blue-900">{selectedFile.name}</p>
                  <p className="text-xs text-blue-700">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                </div>
              )}
            </label>
          </div>

          {/* Upload Button */}
          {selectedFile && uploadStatus === 'idle' && (
            <button
              onClick={handleUpload}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {isAutoMode ? '스룩페이로 자동 업로드' : '파일 준비하기'}
            </button>
          )}

          {/* Upload Progress */}
          {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {uploadStatus === 'uploading' ? '파일 업로드 중...' : '스룩페이 처리 중...'}
                </span>
                <span className="text-gray-900 font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              {uploadStatus === 'processing' && isAutoMode && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Playwright로 자동 업로드 진행 중... (약 1-3분 소요)</span>
                </div>
              )}
            </div>
          )}

          {/* Upload Results */}
          {uploadStatus === 'completed' && uploadResults && (
            <div className="space-y-4">
              {uploadResults.manualMode ? (
                // 수동 모드 결과
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-yellow-900">파일 준비 완료</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        엑셀 파일이 준비되었습니다. 아래 단계를 따라 수동으로 업로드하세요:
                      </p>
                      <ol className="mt-2 space-y-1 text-sm text-yellow-800 list-decimal list-inside">
                        <li>아래 다운로드 버튼을 클릭하여 파일을 저장</li>
                        <li>스룩페이 사이트 접속 (우측 상단 &apos;스룩페이 열기&apos; 버튼 클릭)</li>
                        <li>로그인 후 상품관리 → 대량등록 메뉴 이동</li>
                        <li>다운로드한 엑셀 파일 업로드</li>
                      </ol>
                      <div className="mt-3 flex gap-2">
                        <a
                          href={uploadResults.downloadUrl}
                          download={uploadResults.fileName}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          엑셀 다운로드
                        </a>
                        <button
                          onClick={openStrokePay}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <Globe className="w-4 h-4" />
                          스룩페이 열기
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // 자동 모드 결과
                <>
                  {/* Summary */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-green-900">업로드 완료!</p>
                        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-green-700">전체 상품</p>
                            <p className="text-xl font-bold text-green-900">{uploadResults.totalProducts}</p>
                          </div>
                          <div>
                            <p className="text-green-700">성공</p>
                            <p className="text-xl font-bold text-green-900">{uploadResults.successCount}</p>
                          </div>
                          <div>
                            <p className="text-red-700">실패</p>
                            <p className="text-xl font-bold text-red-900">{uploadResults.failedCount}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Errors */}
                  {uploadResults.errors && uploadResults.errors.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-red-900">업로드 실패 항목</p>
                          <ul className="mt-2 space-y-1">
                            {uploadResults.errors.map((error: any, index: number) => (
                              <li key={index} className="text-sm text-red-700">
                                • {error.product}: {error.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Links */}
                  {uploadResults.paymentLinks && uploadResults.paymentLinks.length > 0 && (
                    <div className="border border-gray-200 rounded-lg">
                      <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="font-semibold">생성된 결제 링크</h3>
                        <p className="text-sm text-gray-600 mt-1">각 상품의 결제 링크를 복사하여 사용하세요</p>
                      </div>
                      <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                        {uploadResults.paymentLinks.map((item: any) => (
                          <div key={item.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                              <p className="text-xs text-gray-500 mt-1 truncate">{item.link}</p>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={() => copyToClipboard(item.link)}
                                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                title="복사"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                title="열기"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">업로드 가이드</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">1</span>
              엑셀 파일 준비
            </h4>
            <ul className="space-y-1 text-sm text-gray-600 ml-8">
              <li>• 스룩페이 공식 양식 사용</li>
              <li>• 필수 항목 모두 입력</li>
              <li>• 이미지 URL 유효성 확인</li>
              <li>• 옵션 형식: 옵션명/공급가/판매가</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">2</span>
              업로드 진행
            </h4>
            <ul className="space-y-1 text-sm text-gray-600 ml-8">
              <li>• 자동 모드: 환경변수에 계정 설정</li>
              <li>• 수동 모드: 직접 사이트에서 업로드</li>
              <li>• 대량 업로드 시 시간 소요</li>
              <li>• 업로드 후 결제링크 확인</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// Download 아이콘 import 추가 필요
import { Download } from 'lucide-react'