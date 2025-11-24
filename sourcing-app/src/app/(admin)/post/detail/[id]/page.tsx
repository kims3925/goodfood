'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Trash2, MessageCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'

interface PostImage {
  id: number
  postId: number
  name: string
  imageUrl: string
  fileSize: number | null
  sortOrder: number
}

interface PostComment {
  id: number
  postId: number
  author: string
  content: string
  publishedAt: string | null
  createdAt: string
}

interface Post {
  id: number
  userId: number
  wholesaleBandId: number
  externalId: string
  title: string
  content: string
  originalContent: string
  author: string | null
  publishedAt: string | null
  status: string
  createdAt: string
  wholesaleBand: {
    id: number
    name: string
    bandKey: string
    coverUrl: string | null
  }
  user: {
    email: string
    name: string | null
  }
  images: PostImage[]
  comments: PostComment[]
}

export default function PostDetailPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string

  const [post, setPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // 수정 가능한 필드
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    author: '',
  })

  useEffect(() => {
    if (postId) {
      loadPost()
    }
  }, [postId])

  const loadPost = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/post/${postId}`)
      const data = await response.json()

      if (data.success && data.data) {
        setPost(data.data)
        setFormData({
          title: data.data.title || '',
          content: data.data.content || '',
          author: data.data.author || '',
        })
      } else {
        alert(data.error || '게시물을 찾을 수 없습니다.')
        router.push('/post/list')
      }
    } catch (error) {
      console.error('게시물 조회 실패:', error)
      alert('게시물을 불러오는데 실패했습니다.')
      router.push('/post/list')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!post) return

    try {
      setIsSaving(true)
      const response = await fetch('/api/post', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: post.id,
          title: formData.title,
          content: formData.content,
          author: formData.author || null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('게시물이 저장되었습니다.')
        loadPost()
      } else {
        alert(data.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('게시물 저장 실패:', error)
      alert('게시물 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!post) return
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/post?id=${post.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        alert('게시물이 삭제되었습니다.')
        router.push('/post/list')
      } else {
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('게시물 삭제 실패:', error)
      alert('게시물 삭제에 실패했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      COLLECTED: { label: '수집됨', color: 'bg-blue-100 text-blue-800' },
      ANALYZING: { label: 'AI 분석중', color: 'bg-yellow-100 text-yellow-800' },
      ANALYZED: { label: 'AI 분석완료', color: 'bg-green-100 text-green-800' },
      MODIFIED: { label: '수정됨', color: 'bg-purple-100 text-purple-800' },
      READY: { label: '발행준비', color: 'bg-indigo-100 text-indigo-800' },
      PUBLISHED: { label: '발행완료', color: 'bg-gray-100 text-gray-800' },
      FAILED: { label: '실패', color: 'bg-red-100 text-red-800' },
    }

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!post) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/post/list')}
            >
              <ArrowLeft size={20} />
              목록으로
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">게시물 상세</h1>
            {getStatusBadge(post.status)}
          </div>
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={handleDelete}
            >
              <Trash2 size={16} />
              삭제
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save size={16} />
              {isSaving ? '저장중...' : '저장'}
            </Button>
          </div>
        </div>

        {/* 메타 정보 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">출처 밴드</label>
              <div className="flex items-center gap-3 mt-1">
                {post.wholesaleBand.coverUrl ? (
                  <img
                    src={post.wholesaleBand.coverUrl}
                    alt={post.wholesaleBand.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">No</span>
                  </div>
                )}
                <div>
                  <div className="font-medium text-gray-900">{post.wholesaleBand.name}</div>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">수집일</label>
              <div className="text-gray-900 mt-1">
                {new Date(post.createdAt).toLocaleString('ko-KR')}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">원본 발행일</label>
              <div className="text-gray-900 mt-1">
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleString('ko-KR')
                  : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* 수정 폼 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">게시물 정보</h2>

          <div className="space-y-6">
            {/* 작성자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                작성자
              </label>
              <Input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="작성자"
              />
            </div>

            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                제목
              </label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="제목"
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                내용
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={20}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="내용"
              />
            </div>
          </div>
        </div>

        {/* 이미지 갤러리 */}
        {post.images && post.images.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              이미지 ({post.images.length}개)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {post.images.map((image, index) => (
                <div key={image.id} className="relative group">
                  <img
                    src={image.imageUrl}
                    alt={`이미지 ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                    <a
                      href={image.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium"
                    >
                      원본 보기
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 댓글 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={20} className="text-gray-400" />
            <h2 className="text-xl font-bold text-gray-900">
              댓글 ({post.comments?.length || 0}개)
            </h2>
          </div>
          {post.comments && post.comments.length > 0 ? (
            <div className="space-y-4">
              {post.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="border-l-4 border-blue-500 bg-gray-50 p-4 rounded-r-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {comment.author.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{comment.author}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {comment.publishedAt
                        ? new Date(comment.publishedAt).toLocaleString('ko-KR')
                        : new Date(comment.createdAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <MessageCircle size={48} className="mx-auto mb-4 text-gray-300" />
              <p>댓글이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
