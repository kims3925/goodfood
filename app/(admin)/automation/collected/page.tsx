'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from '@/components/ui'
import { RefreshCw, Eye, Check, X } from 'lucide-react'

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

  const fetchCollectedPosts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/wholesale/posts')
      if (!response.ok) {
        throw new Error('Failed to fetch collected posts')
      }
      const data = await response.json()
      setPosts(data.posts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCollectedPosts()
  }, [])

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
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <X className="h-8 w-8 mx-auto mb-2" />
              <p>오류가 발생했습니다: {error}</p>
              <Button onClick={fetchCollectedPosts} className="mt-4">
                다시 시도
              </Button>
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
        <Button onClick={fetchCollectedPosts} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
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