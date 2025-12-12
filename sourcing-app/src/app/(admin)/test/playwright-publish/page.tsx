'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Send, Image, Loader2, CheckCircle, XCircle, RefreshCw, StopCircle } from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/ui/Button'

// 타임아웃 설정 (1분)
const PUBLISH_TIMEOUT_MS = 1 * 60 * 1000

interface Channel {
  id: number
  name: string
  kind: string
  hasSession: boolean
  sessionExpired: boolean
  expiresAt: string | null
}

export default function PlaywrightPublishTestPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [content, setContent] = useState('')
  const [imageUrls, setImageUrls] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; data?: any } | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // AbortController ref for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 채널 목록 로드
  const loadChannels = async () => {
    setIsLoadingChannels(true)
    try {
      const response = await fetch('/api/test/playwright-publish')
      const data = await response.json()
      if (data.success) {
        setChannels(data.data)
        if (data.data.length > 0 && !selectedChannelId) {
          setSelectedChannelId(data.data[0].id)
        }
      }
    } catch (error) {
      console.error('채널 목록 로드 실패:', error)
    } finally {
      setIsLoadingChannels(false)
    }
  }

  useEffect(() => {
    loadChannels()
  }, [])

  // 타이머 정리
  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // 요청 중지
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    clearTimer()
    setIsPublishing(false)
    setElapsedTime(0)
    setResult({
      success: false,
      message: '사용자가 발행을 취소했습니다.',
    })
  }

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      clearTimer()
    }
  }, [])

  // 발행 테스트
  const handlePublish = async () => {
    if (!selectedChannelId) {
      alert('채널을 선택해주세요.')
      return
    }

    if (!content.trim()) {
      alert('게시물 내용을 입력해주세요.')
      return
    }

    const urls = imageUrls
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)

    if (urls.length === 0) {
      alert('이미지 URL을 입력해주세요.')
      return
    }

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // 새 AbortController 생성
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setIsPublishing(true)
    setResult(null)
    setElapsedTime(0)

    // 경과 시간 타이머 시작
    const startTime = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    // 타임아웃 설정
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current === abortController) {
        abortController.abort()
        clearTimer()
        setIsPublishing(false)
        setElapsedTime(0)
        setResult({
          success: false,
          message: `발행 시간이 초과되었습니다. (${PUBLISH_TIMEOUT_MS / 1000}초)`,
        })
      }
    }, PUBLISH_TIMEOUT_MS)

    try {
      const response = await fetch('/api/test/playwright-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannelId,
          content: content.trim(),
          imageUrls: urls,
        }),
        signal: abortController.signal,
      })

      const data = await response.json()
      setResult({
        success: data.success,
        message: data.success ? data.message : data.error,
        data: data.data,
      })
    } catch (error: any) {
      // AbortError는 취소/타임아웃에서 이미 처리됨
      if (error.name === 'AbortError') {
        return
      }
      setResult({
        success: false,
        message: error.message || '발행 중 오류가 발생했습니다.',
      })
    } finally {
      clearTimeout(timeoutId)
      clearTimer()
      setIsPublishing(false)
      setElapsedTime(0)
      abortControllerRef.current = null
    }
  }

  // 샘플 데이터 채우기
  const fillSampleData = () => {
    setContent(`테스트 상품입니다.

상품명: 테스트 상품
가격: 10,000원
배송비: 무료

주문은 아래 링크에서!`)
    setImageUrls(`https://picsum.photos/800/600
https://picsum.photos/800/601
https://picsum.photos/800/602`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/sourcing/channel"
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Playwright 이미지 발행 테스트</h1>
            <p className="text-gray-600 text-sm mt-1">
              Playwright를 사용하여 이미지가 포함된 게시물을 Band에 발행합니다.
            </p>
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-800 mb-2">사용 방법</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Chrome Extension으로 Band 세션을 먼저 등록하세요</li>
            <li>세션이 등록된 채널을 선택하세요</li>
            <li>게시물 내용과 이미지 URL을 입력하세요</li>
            <li>발행 테스트 버튼을 클릭하세요</li>
          </ol>
        </div>

        {/* 메인 폼 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* 채널 선택 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                채널 선택 <span className="text-red-500">*</span>
              </label>
              <button
                onClick={loadChannels}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <RefreshCw size={14} />
                새로고침
              </button>
            </div>

            {isLoadingChannels ? (
              <div className="flex items-center gap-2 text-gray-500 py-4">
                <Loader2 size={16} className="animate-spin" />
                채널 목록 로딩 중...
              </div>
            ) : channels.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                세션이 등록된 채널이 없습니다. Chrome Extension으로 Band 세션을 먼저 등록해주세요.
              </div>
            ) : (
              <select
                value={selectedChannelId || ''}
                onChange={(e) => setSelectedChannelId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id} disabled={ch.sessionExpired}>
                    {ch.name} ({ch.kind === 'WHOLESALE' ? '도매' : '소매'})
                    {ch.sessionExpired ? ' - 세션 만료' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 게시물 내용 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              게시물 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="게시물 내용을 입력하세요..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* 이미지 URL */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이미지 URL <span className="text-red-500">*</span>
              <span className="text-gray-500 font-normal ml-2">(줄바꿈으로 구분)</span>
            </label>
            <textarea
              value={imageUrls}
              onChange={(e) => setImageUrls(e.target.value)}
              rows={4}
              placeholder={`https://example.com/image1.jpg\nhttps://example.com/image2.jpg\nhttps://example.com/image3.jpg`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              이미지 URL: {imageUrls.split('\n').filter((u) => u.trim()).length}개
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex items-center gap-3">
            {isPublishing ? (
              <>
                <Button
                  variant="danger"
                  onClick={handleCancel}
                  className="flex items-center gap-2"
                >
                  <StopCircle size={16} />
                  중지
                </Button>
                <div className="flex items-center gap-2 text-gray-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span>발행 중... ({elapsedTime}초)</span>
                </div>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  onClick={handlePublish}
                  disabled={channels.length === 0}
                  className="flex items-center gap-2"
                >
                  <Send size={16} />
                  발행 테스트
                </Button>

                <Button variant="secondary" onClick={fillSampleData}>
                  <Image size={16} className="mr-2" />
                  샘플 데이터 채우기
                </Button>
              </>
            )}
          </div>

          {/* 타임아웃 안내 */}
          {isPublishing && (
            <p className="text-xs text-gray-500 mt-2">
              {PUBLISH_TIMEOUT_MS / 1000}초 후 자동으로 타임아웃됩니다.
            </p>
          )}

          {/* 결과 */}
          {result && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                result.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                ) : (
                  <XCircle className="text-red-600 flex-shrink-0" size={20} />
                )}
                <div>
                  <p
                    className={`font-medium ${
                      result.success ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {result.success ? '발행 성공!' : '발행 실패'}
                  </p>
                  <p
                    className={`text-sm mt-1 ${
                      result.success ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {result.message}
                  </p>
                  {result.data && (
                    <div className="mt-2 text-sm text-green-700">
                      <p>채널: {result.data.channelName}</p>
                      <p>이미지 수: {result.data.imageCount}개</p>
                      {result.data.postKey && <p>Post Key: {result.data.postKey}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 주의사항 */}
        <div className="mt-6 bg-gray-100 rounded-lg p-4">
          <h3 className="font-medium text-gray-800 mb-2">주의사항</h3>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>이 기능은 테스트용입니다. 실제 Band에 게시물이 발행됩니다.</li>
            <li>Playwright가 headless 모드로 실행됩니다.</li>
            <li>이미지 업로드에 시간이 걸릴 수 있습니다. (이미지당 약 5-10초)</li>
            <li>세션이 만료된 경우 Chrome Extension으로 다시 등록해주세요.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
