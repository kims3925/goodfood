'use client'

import { useState } from 'react'
import { ArrowLeft, Download, Chrome, LogIn, MousePointer, CheckCircle, AlertCircle, Copy, Check, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function BandSessionGuidePage() {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const handleCopyExtensionUrl = () => {
    navigator.clipboard.writeText('chrome://extensions')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 상단 네비게이션 */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">돌아가기</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-100 rounded-2xl mb-4">
            <Chrome size={32} className="text-violet-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">밴드 세션 저장 가이드</h1>
          <p className="text-slate-600 max-w-xl mx-auto">
            Chrome 확장프로그램을 사용하여 밴드 로그인 세션을 저장하면<br />
            자동으로 밴드 게시물을 수집할 수 있습니다.
          </p>
        </div>

        {/* 자동화 안내 (v1.3.0, 2026-06-10) */}
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircle size={22} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-emerald-900 mb-1">이제 수동 저장은 사실상 필요 없습니다</h2>
              <p className="text-sm text-emerald-800 leading-relaxed">
                <a href="/sourcing/settings/api" className="underline font-semibold">설정 &gt; API</a>에서{' '}
                <strong>확장프로그램 키를 1회 발급</strong>하면, 확장이 소싱앱 로그인 만료와 무관하게 밴드 세션을
                자동 동기화합니다 (1시간 주기 + 밴드 쿠키 변경 시 즉시). 서버도 6시간마다 세션을 연장(keep-alive)하므로,
                밴드 비밀번호 변경·강제 로그아웃 시에만 band.us 재로그인 1회가 필요합니다.
                자동 동기화가 끊기면 확장 아이콘에 <span className="font-mono text-red-600">!</span> 뱃지와 알림이 표시됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 다운로드 섹션 */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Band Session Helper</h2>
              <p className="text-violet-100 text-sm">Chrome 확장프로그램 다운로드</p>
            </div>
            <a
              href="/api/extension/download"
              download="band-session-extension.zip"
              className="flex items-center gap-2 px-6 py-3 bg-white text-violet-600 font-semibold rounded-xl hover:bg-violet-50 transition-colors"
            >
              <Download size={20} />
              다운로드
            </a>
          </div>
        </div>

        {/* 설치 방법 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-lg text-sm font-bold">1</span>
            확장프로그램 설치
          </h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold text-sm">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">다운로드 파일 압축 해제</h3>
                <p className="text-slate-600 text-sm">
                  위에서 다운로드한 <code className="px-1.5 py-0.5 bg-slate-100 rounded text-violet-600 text-xs">band-session-extension.zip</code> 파일의 압축을 해제합니다.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold text-sm">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">Chrome 확장프로그램 페이지 열기</h3>
                <p className="text-slate-600 text-sm mb-2">
                  Chrome 주소창에 아래 주소를 입력합니다.
                </p>
                <div className="flex items-center gap-2">
                  <code className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-mono text-slate-700">
                    chrome://extensions
                  </code>
                  <button
                    onClick={handleCopyExtensionUrl}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      copied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={14} />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        복사
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold text-sm">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">개발자 모드 활성화</h3>
                <p className="text-slate-600 text-sm">
                  우측 상단의 <span className="font-semibold text-slate-900">개발자 모드</span> 토글을 켭니다.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold text-sm">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">확장프로그램 로드</h3>
                <p className="text-slate-600 text-sm">
                  <span className="font-semibold text-slate-900">압축해제된 확장 프로그램을 로드합니다</span> 버튼을 클릭하고,<br />
                  압축 해제한 <code className="px-1.5 py-0.5 bg-slate-100 rounded text-violet-600 text-xs">band-session-extension</code> 폴더를 선택합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 사용 방법 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 rounded-lg text-sm font-bold">2</span>
            세션 저장하기
          </h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold text-sm">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <LogIn size={16} className="text-blue-500" />
                  Sourcing App 로그인
                </h3>
                <p className="text-slate-600 text-sm">
                  현재 사이트(snsauto.abcpharm.net)에 먼저 로그인되어 있어야 합니다.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold text-sm">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <LogIn size={16} className="text-violet-500" />
                  Band 로그인
                </h3>
                <p className="text-slate-600 text-sm mb-2">
                  새 탭에서 Band에 로그인합니다.
                </p>
                <a
                  href="https://band.us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors"
                >
                  Band 열기
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold text-sm">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <MousePointer size={16} className="text-amber-500" />
                  확장프로그램 실행
                </h3>
                <p className="text-slate-600 text-sm">
                  Chrome 우측 상단의 퍼즐 모양 아이콘을 클릭하고<br />
                  <span className="font-semibold text-slate-900">Band Session Helper</span>를 선택합니다.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold text-sm">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" />
                  세션 저장
                </h3>
                <p className="text-slate-600 text-sm">
                  &quot;저장 준비 완료&quot; 상태가 표시되면 <span className="font-semibold text-violet-600">세션 저장하기</span> 버튼을 클릭합니다.<br />
                  등록된 모든 소매 밴드 채널에 세션이 자동으로 저장됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 주의사항 */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-600" />
            주의사항
          </h2>
          <ul className="space-y-2 text-amber-800 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              세션은 약 <span className="font-semibold">14일</span> 후 만료됩니다. 만료 전에 다시 저장해주세요.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              Band에서 로그아웃하면 세션이 무효화됩니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              확장프로그램은 Band와 Sourcing App의 쿠키만 읽으며, 다른 사이트의 정보는 접근하지 않습니다.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
