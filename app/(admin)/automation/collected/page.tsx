'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from '@/components/ui'
import { RefreshCw, Eye, Check, X, Zap, Brain } from 'lucide-react'

interface CollectedPost {
  id: string
  title: string
  status: string
  createdAt: string
  bandCreatedAt: string
  productCategory: string
  hookingTitle?: string
  extractedPrice?: number
  adjustedPrice?: number
  aiAnalyzed: boolean
  wholesaleBand: {
    id: string
    name: string
    bandKey: string
    pricingPolicy: string
  }
}

export default function CollectedPage() {
  const [posts, setPosts] = useState<CollectedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [pendingAnalysisCount, setPendingAnalysisCount] = useState(0)

  const fetchCollectedPosts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/wholesale/posts')

      if (!response.ok) {
        if (response.status === 401) {
          setError('로그인이 필요합니다. 로그인 후 다시 시도해주세요.')
        } else if (response.status === 403) {
          setError('접근 권한이 없습니다.')
        } else if (response.status === 404) {
          setError('데이터를 찾을 수 없습니다.')
        } else if (response.status >= 500) {
          setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        } else {
          setError(`오류가 발생했습니다. (상태 코드: ${response.status})`)
        }
        setPosts([])
        return
      }

      const data = await response.json()
      setPosts(data.posts || [])
      setError(null)
    } catch (err) {
      console.error('수집 게시물 조회 오류:', err)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('네트워크 연결을 확인해주세요.')
      } else {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      }
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCollectedPosts()
    fetchPendingAnalysisCount()
  }, [])

  const fetchPendingAnalysisCount = async () => {
    try {
      const response = await fetch('/api/wholesale/posts/analyze')
      const data = await response.json()
      if (data.success) {
        setPendingAnalysisCount(data.pendingCount || 0)
      }
    } catch (err) {
      console.error('미분석 게시물 개수 조회 실패:', err)
    }
  }

  const handleRunAIAnalysis = async () => {
    if (!confirm(`미분석된 ${pendingAnalysisCount}개 게시물을 AI로 분석하시겠습니까?`)) {
      return
    }

    try {
      setIsAnalyzing(true)
      const response = await fetch('/api/wholesale/posts/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // 모든 미분석 게시물
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message || `${data.analyzed}개 게시물의 AI 분석이 완료되었습니다.`)
        fetchCollectedPosts()
        fetchPendingAnalysisCount()
      } else {
        alert('AI 분석 실패: ' + data.error)
      }
    } catch (error) {
      console.error('AI 분석 오류:', error)
      alert('AI 분석 중 오류가 발생했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">대기중</Badge>
      case 'ANALYZED':
        return <Badge variant="default">분석완료</Badge>
      case 'CONFIRMED':
        return <Badge variant="default" className="bg-green-100 text-green-800">소싱확정</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">제외</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">수집된 게시물을 불러오는 중...</span>
        </div>
      </div>
    )
  }

  if (error) {
    const isAuthError = error.includes('로그인') || error.includes('권한')

    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${
                isAuthError ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                <X className={`h-8 w-8 ${isAuthError ? 'text-yellow-600' : 'text-red-600'}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {isAuthError ? '인증 필요' : '오류 발생'}
              </h3>
              <p className="text-muted-foreground mb-6">{error}</p>
              <div className="flex gap-3 justify-center">
                {isAuthError && (
                  <Button
                    onClick={() => window.location.href = '/auth/login'}
                    variant="default"
                  >
                    로그인하기
                  </Button>
                )}
                <Button
                  onClick={fetchCollectedPosts}
                  variant={isAuthError ? "outline" : "default"}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  다시 시도
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">수집 현황</h1>
          <p className="text-muted-foreground">도매 밴드에서 수집된 게시물 현황을 확인합니다</p>
        </div>
        <div className="flex gap-2">
          {pendingAnalysisCount > 0 && (
            <Button
              onClick={handleRunAIAnalysis}
              disabled={isAnalyzing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  AI 분석 실행 ({pendingAnalysisCount}개)
                </>
              )}
            </Button>
          )}
          <Button onClick={fetchCollectedPosts} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 수집</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{posts.length}</div>
            <p className="text-xs text-muted-foreground">총 수집된 게시물</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">분석 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{posts.filter(p => p.aiAnalyzed).length}</div>
            <p className="text-xs text-muted-foreground">AI 분석 완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">소싱 확정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{posts.filter(p => p.status === 'CONFIRMED').length}</div>
            <p className="text-xs text-muted-foreground">소싱 확정된 상품</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">대기중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{posts.filter(p => p.status === 'PENDING').length}</div>
            <p className="text-xs text-muted-foreground">처리 대기중</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>수집된 게시물 목록</CardTitle>
          <CardDescription>
            최근 수집된 게시물들의 상태를 확인할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <div className="text-center py-8">
              <Eye className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">수집된 게시물이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{post.title}</h3>
                      {getStatusBadge(post.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {post.wholesaleBand.name} • {new Date(post.bandCreatedAt).toLocaleDateString('ko-KR')}
                    </p>
                    {post.aiAnalyzed && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">분류:</span> {post.productCategory} •
                        <span className="text-muted-foreground ml-2">가격:</span> {post.adjustedPrice?.toLocaleString() || post.extractedPrice?.toLocaleString() || '-'}원
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    상세보기
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}