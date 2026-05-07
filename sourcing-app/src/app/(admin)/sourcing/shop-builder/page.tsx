/**
 * AI 페이지 빌더 — 메인 (4-step 플로우)
 *
 * Step 1. 소스 입력 (URL / HTML 직접)
 * Step 2. AI 추출 결과 미리보기 (상품명/가격/이미지/옵션)
 * Step 3. 템플릿 선택 + 색상
 * Step 4. 페이지 생성 + HTML 미리보기 + 다운로드/복사
 */
'use client'

import { useState } from 'react'
import {
  Globe,
  Upload,
  FileCode,
  Sparkles,
  Loader2,
  Check,
  ArrowLeft,
  RefreshCw,
  Copy,
  Download,
  Eye,
} from 'lucide-react'

type Step = 'input' | 'preview' | 'template' | 'generate'

interface ExtractedProduct {
  name: string
  price: number | null
  originalPrice?: number | null
  discount?: number | null
  images: string[]
  options: Array<{ name: string; values: string[] }>
  description: string
  category?: string | null
  seoDescription?: string | null
  sellingPoints?: string[]
  tags?: string[]
}

interface ImportResult {
  product: ExtractedProduct
  layout: any | null
  screenshot: string | null
  jobId?: number
}

interface GenerateResult {
  html: string
  meta: { title: string; description: string; ogImage?: string }
  templateId: string
  copy: any
}

const STEPS: { key: Step; label: string; icon: any }[] = [
  { key: 'input', label: '소스 입력', icon: Globe },
  { key: 'preview', label: 'AI 추출', icon: Sparkles },
  { key: 'template', label: '템플릿', icon: FileCode },
  { key: 'generate', label: '페이지 생성', icon: Upload },
]

export default function ShopBuilderPage() {
  const [step, setStep] = useState<Step>('input')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [jobId, setJobId] = useState<number | null>(null)
  const [templateId, setTemplateId] = useState<string>('basic')
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-500" />
          AI 쇼핑몰 페이지 빌더
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          URL 또는 HTML 입력 → AI 분석 → 카피라이팅 → 상세페이지 자동 생성
        </p>
      </header>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {STEPS.map((s, i) => {
          const isActive = step === s.key
          const isDone = STEPS.findIndex((x) => x.key === step) > i
          return (
            <div key={s.key} className="flex items-center gap-2 shrink-0">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : isDone
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-400'
                }`}
              >
                {isDone ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                <span>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <span className="text-gray-300">→</span>}
            </div>
          )
        })}
      </div>

      {step === 'input' && (
        <ImportForm
          onComplete={(data) => {
            setImportResult(data)
            if (data.jobId) setJobId(data.jobId)
            setStep('preview')
          }}
        />
      )}

      {step === 'preview' && importResult && (
        <ExtractedPreview
          data={importResult}
          onConfirm={() => setStep('template')}
          onBack={() => setStep('input')}
        />
      )}

      {step === 'template' && (
        <TemplateSelector
          selected={templateId}
          onChange={setTemplateId}
          onBack={() => setStep('preview')}
          onNext={() => setStep('generate')}
        />
      )}

      {step === 'generate' && jobId && (
        <PagePreview
          jobId={jobId}
          templateId={templateId}
          result={generateResult}
          setResult={setGenerateResult}
          onBack={() => setStep('template')}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Step 1: ImportForm
// ─────────────────────────────────────────────────────────────
function ImportForm({ onComplete }: { onComplete: (data: ImportResult) => void }) {
  const [mode, setMode] = useState<'url' | 'html'>('url')
  const [url, setUrl] = useState('')
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleUrlImport() {
    if (!url.trim()) return setError('URL 을 입력하세요')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/shop-builder/import-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), mode: 'full' }),
      }).then((r) => r.json())
      if (res.success) onComplete({ ...res.data, jobId: res.jobId })
      else setError(res.error || '스크래핑 실패')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleHtmlImport() {
    if (!html.trim()) return setError('HTML 코드를 붙여넣으세요')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/shop-builder/import-html', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, runAiEnrichment: true }),
      }).then((r) => r.json())
      if (res.success) onComplete({ ...res.data, jobId: res.jobId })
      else setError(res.error || '파싱 실패')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-2">1. 소스 입력</h2>
      <p className="text-sm text-gray-600 mb-4">
        쇼핑몰 URL 또는 HTML 코드를 입력하면 AI 가 상품명/가격/이미지를 추출합니다.
      </p>

      <div className="flex gap-2 border-b border-gray-200 mb-4">
        {[
          { key: 'url', label: 'URL 링크', icon: Globe },
          { key: 'html', label: 'HTML 코드', icon: FileCode },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 ${
              mode === tab.key
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {mode === 'url' && (
        <div className="space-y-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://smartstore.naver.com/... 또는 경쟁사 쇼핑몰 URL"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
          />
          <p className="text-xs text-gray-500">
            네이버 스마트스토어, 쿠팡, 11번가, 자사몰 등 대부분 쇼핑몰 URL 지원. 약 10-30초 소요.
          </p>
          <button
            onClick={handleUrlImport}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> AI 분석 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> AI 분석 시작
              </>
            )}
          </button>
        </div>
      )}

      {mode === 'html' && (
        <div className="space-y-3">
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<!DOCTYPE html>... 쇼핑몰 페이지 HTML 소스코드를 붙여넣으세요"
            rows={12}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-xs"
          />
          <button
            onClick={handleHtmlImport}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 분석 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> HTML 분석 시작
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Step 2: ExtractedPreview
// ─────────────────────────────────────────────────────────────
function ExtractedPreview({
  data,
  onConfirm,
  onBack,
}: {
  data: ImportResult
  onConfirm: () => void
  onBack: () => void
}) {
  const p = data.product
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">2. AI 추출 결과</h2>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 다시 입력
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold mb-2 text-gray-700">상품 정보</h3>
          <dl className="space-y-2 text-sm">
            <Row label="상품명" value={p.name || '(미추출)'} />
            <Row label="가격" value={p.price ? `${p.price.toLocaleString('ko-KR')}원` : '(미추출)'} />
            {p.originalPrice && p.discount && (
              <Row
                label="원가/할인"
                value={`${p.originalPrice.toLocaleString('ko-KR')}원 (${p.discount}% 할인)`}
              />
            )}
            <Row label="카테고리" value={p.category || '미분류'} />
            <Row label="이미지" value={`${p.images.length}장`} />
            <Row label="옵션" value={`${p.options.length}개 그룹`} />
          </dl>

          {p.sellingPoints && p.sellingPoints.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2 text-gray-700">AI 추출 판매 포인트</h3>
              <ul className="text-xs space-y-1 list-disc list-inside text-gray-700">
                {p.sellingPoints.map((sp, i) => (
                  <li key={i}>{sp}</li>
                ))}
              </ul>
            </div>
          )}

          {p.seoDescription && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2 text-gray-700">SEO 설명</h3>
              <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">{p.seoDescription}</p>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 text-gray-700">이미지 미리보기 (상위 6장)</h3>
          <div className="grid grid-cols-3 gap-2">
            {p.images.slice(0, 6).map((src, i) => (
              <img key={i} src={src} alt={`이미지 ${i + 1}`} className="w-full aspect-square object-cover rounded border border-gray-200" />
            ))}
          </div>
          {data.screenshot && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2 text-gray-700">원본 페이지 스크린샷</h3>
              <img src={data.screenshot} alt="screenshot" className="w-full max-h-[400px] object-contain border border-gray-200 rounded" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onConfirm}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
        >
          확인 → 템플릿 선택
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <dt className="w-24 text-gray-500 shrink-0">{label}</dt>
      <dd className="text-gray-900 font-medium">{value}</dd>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Step 3: TemplateSelector
// ─────────────────────────────────────────────────────────────
function TemplateSelector({
  selected,
  onChange,
  onBack,
  onNext,
}: {
  selected: string
  onChange: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const templates = [
    {
      id: 'basic',
      name: '기본 상세페이지',
      desc: '히어로 + 갤러리 + 셀링포인트 + FAQ. 모든 카테고리 호환',
      preview: '🛍️',
    },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">3. 템플릿 선택</h2>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 이전
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`text-left p-4 rounded-lg border-2 transition-colors ${
              selected === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'
            }`}
          >
            <div className="text-3xl mb-2">{t.preview}</div>
            <div className="font-semibold">{t.name}</div>
            <div className="text-xs text-gray-600 mt-1">{t.desc}</div>
          </button>
        ))}
        <div className="p-4 rounded-lg border-2 border-dashed border-gray-200 text-center text-gray-400 text-sm">
          더 많은 템플릿은 Phase 2 후속 작업에서 추가됩니다 (premium, seafood 등)
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
        >
          페이지 생성 →
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Step 4: PagePreview (생성 + 미리보기 + 복사/다운로드)
// ─────────────────────────────────────────────────────────────
function PagePreview({
  jobId,
  templateId,
  result,
  setResult,
  onBack,
}: {
  jobId: number
  templateId: string
  result: GenerateResult | null
  setResult: (r: GenerateResult | null) => void
  onBack: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'iframe' | 'code'>('iframe')

  async function generate(regenerate = false) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/shop-builder/generate-detail', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, templateId }),
      }).then((r) => r.json())
      if (res.success) setResult(res.data)
      else setError(res.error || '생성 실패')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function copyHtml() {
    if (!result) return
    await navigator.clipboard.writeText(result.html)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function downloadHtml() {
    if (!result) return
    const blob = new Blob([result.html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `detail-${jobId}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">4. 페이지 생성</h2>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 이전
        </button>
      </div>

      {!result && (
        <div className="text-center py-12">
          <button
            onClick={() => generate()}
            disabled={loading}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> AI 카피 생성 중...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" /> AI 페이지 생성
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 mt-3">약 5-15초 소요</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => generate(true)}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> 재생성
            </button>
            <button
              onClick={copyHtml}
              className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> HTML 복사
                </>
              )}
            </button>
            <button
              onClick={downloadHtml}
              className="px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded flex items-center gap-1"
            >
              <Download className="w-4 h-4" /> .html 다운로드
            </button>
            <div className="ml-auto flex gap-1">
              <button
                onClick={() => setViewMode('iframe')}
                className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                  viewMode === 'iframe' ? 'bg-gray-800 text-white' : 'bg-gray-100'
                }`}
              >
                <Eye className="w-4 h-4" /> 미리보기
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                  viewMode === 'code' ? 'bg-gray-800 text-white' : 'bg-gray-100'
                }`}
              >
                <FileCode className="w-4 h-4" /> 코드
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {viewMode === 'iframe' ? (
              <iframe srcDoc={result.html} className="w-full" style={{ height: '70vh' }} sandbox="allow-same-origin" />
            ) : (
              <pre className="bg-gray-900 text-gray-100 text-xs p-4 overflow-auto" style={{ maxHeight: '70vh' }}>
                {result.html}
              </pre>
            )}
          </div>

          <div className="text-xs text-gray-500 grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
            <div>
              <span className="font-semibold">템플릿:</span> {result.templateId}
            </div>
            <div>
              <span className="font-semibold">제목:</span> {result.meta.title}
            </div>
            <div className="truncate">
              <span className="font-semibold">설명:</span> {result.meta.description}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
