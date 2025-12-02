'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Trash2, MessageCircle, ImageIcon, Calendar, User, ExternalLink } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import ImageGallery from '@/components/ui/ImageGallery'

interface PostImage {
  id: number
  postId: number
  url: string
  fileSize: number | null
  sortOrder: number
}

interface PostComment {
  id: number
  postId: number
  author: string
  content: string
  createdAt: string
  updatedAt: string
}

interface Post {
  id: number
  userId: number
  channelId: number
  externalId: string
  title: string
  content: string
  author: string | null
  status: string
  createdAt: string
  channel: {
    id: number
    name: string
    channelKey: string
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
  const toast = useToast()
  const postId = params.id as string

  const [post, setPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
        router.push('/post/list')
      }
    } catch (error) {
      console.error('게시물 조회 실패:', error)
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
        toast.success('게시물이 저장되었습니다.')
        loadPost()
        setIsEditing(false)
      } else {
        toast.error('게시물 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('게시물 저장 실패:', error)
      toast.error('게시물 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (post) {
      setFormData({
        title: post.title || '',
        content: post.content || '',
        author: post.author || '',
      })
    }
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (!post) return
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!post) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/post?id=${post.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('게시물이 삭제되었습니다.')
        router.push('/post/list')
      } else {
        toast.error('게시물 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('게시물 삭제 실패:', error)
      toast.error('게시물 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; bgColor: string; textColor: string; dotColor: string } } = {
      COLLECTED: { label: '수집됨', bgColor: 'bg-blue-50', textColor: 'text-blue-700', dotColor: 'bg-blue-500' },
      ANALYZING: { label: 'AI 분석중', bgColor: 'bg-amber-50', textColor: 'text-amber-700', dotColor: 'bg-amber-500' },
      ANALYZED: { label: 'AI 분석완료', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', dotColor: 'bg-emerald-500' },
      MODIFIED: { label: '수정됨', bgColor: 'bg-violet-50', textColor: 'text-violet-700', dotColor: 'bg-violet-500' },
      READY: { label: '발행준비', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', dotColor: 'bg-indigo-500' },
      PUBLISHED: { label: '발행완료', bgColor: 'bg-slate-100', textColor: 'text-slate-700', dotColor: 'bg-slate-500' },
      FAILED: { label: '실패', bgColor: 'bg-red-50', textColor: 'text-red-700', dotColor: 'bg-red-500' },
    }

    const statusInfo = statusMap[status] || { label: status, bgColor: 'bg-gray-100', textColor: 'text-gray-700', dotColor: 'bg-gray-500' }

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.textColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`}></span>
        {statusInfo.label}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!post) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 상단 네비게이션 바 */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/post/list')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="font-medium">목록</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-slate-200"></div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-slate-400 text-sm">게시물</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 text-sm font-medium truncate max-w-[200px]">
                  {post.title || `#${post.id}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleCancelEdit}
                    className="!px-4 !py-2"
                  >
                    <X size={16} />
                    <span className="hidden sm:inline">취소</span>
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="!px-4 !py-2"
                  >
                    <Save size={16} />
                    {isSaving ? '저장중...' : '저장'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleStartEdit}
                    className="!px-4 !py-2"
                  >
                    <Edit size={16} />
                    <span className="hidden sm:inline">수정</span>
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleDelete}
                    className="!px-4 !py-2"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">삭제</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* 왼쪽: 이미지 갤러리 */}
          <div className="xl:col-span-5 2xl:col-span-4">
            <div className="xl:sticky xl:top-24">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {post.images && post.images.length > 0 ? (
                  <>
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <ImageIcon size={18} className="text-slate-600" />
                        </div>
                        <span className="font-semibold text-slate-900">이미지</span>
                        <span className="text-sm text-slate-500">({post.images.length}개)</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <ImageGallery
                        images={post.images}
                        gridCols={2}
                        aspectRatio="square"
                        enableLightbox={true}
                        showThumbnails={true}
                      />
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                      <ImageIcon size={32} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">이미지가 없습니다</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 오른쪽: 게시물 정보 */}
          <div className="xl:col-span-7 2xl:col-span-8 space-y-6">
            {/* 헤더 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  {post.channel?.coverUrl ? (
                    <img
                      src={post.channel.coverUrl}
                      alt={post.channel.name}
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                      <span className="text-slate-500 text-sm font-medium">B</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-slate-500">출처 밴드</p>
                    <p className="font-semibold text-slate-900">{post.channel?.name || '-'}</p>
                  </div>
                </div>
                {getStatusBadge(post.status)}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm">
                  <User size={16} className="text-slate-400" />
                  <span className="text-slate-500">작성자:</span>
                  <span className="font-medium text-slate-700">{post.author || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm col-span-2">
                  <Calendar size={16} className="text-slate-400" />
                  <span className="text-slate-500">수집일:</span>
                  <span className="font-medium text-slate-700">
                    {new Date(post.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
              </div>
            </div>

            {/* 제목 & 내용 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 space-y-6">
                {/* 작성자 (수정 모드) */}
                {isEditing && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      작성자
                    </label>
                    <Input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      placeholder="작성자 이름"
                      className="!rounded-xl"
                    />
                  </div>
                )}

                {/* 제목 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    제목
                  </label>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="게시물 제목"
                      className="!rounded-xl !text-lg"
                    />
                  ) : (
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                      {post.title || '(제목 없음)'}
                    </h1>
                  )}
                </div>

                {/* 내용 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    내용
                  </label>
                  {isEditing ? (
                    <textarea
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                      rows={16}
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="게시물 내용을 입력하세요"
                    />
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <pre className="whitespace-pre-wrap text-slate-700 text-[15px] leading-relaxed font-sans">
                        {post.content || '(내용 없음)'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 댓글 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MessageCircle size={18} className="text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-900">댓글</span>
                  <span className="px-2 py-0.5 bg-slate-200 rounded-full text-xs font-medium text-slate-600">
                    {post.comments?.length || 0}
                  </span>
                </div>
              </div>

              <div className="p-4">
                {post.comments && post.comments.length > 0 ? (
                  <div className="space-y-3">
                    {post.comments.map((comment, index) => (
                      <div
                        key={comment.id}
                        className="group relative bg-gradient-to-r from-slate-50 to-white p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                            {comment.author.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-900">{comment.author}</span>
                              <span className="text-xs text-slate-400">
                                {new Date(comment.createdAt).toLocaleString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                      <MessageCircle size={32} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">댓글이 없습니다</p>
                    <p className="text-slate-400 text-sm mt-1">아직 작성된 댓글이 없습니다</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="게시물 삭제"
        message="이 게시물을 삭제하시겠습니까? 삭제된 게시물은 복구할 수 없습니다."
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
