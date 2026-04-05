'use client'

import { useState } from 'react'
import { Shield, Mail, Lock, ArrowLeft } from 'lucide-react'

export default function AdminLoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        if (data.user?.role !== 'ADMIN') {
          setError('ì´ëë¯¼ ê³ì ë§ ì ê·¼í  ì ììµëë¤. íë§¤ê´ë¦¬ì ê³ì ì íë§¤ê´ë¦¬ì ë¡ê·¸ì¸ì ì´ì©í´ì£¼ì¸ì.')
          setIsLoading(false)
          return
        }

        // ADMIN ë¡ê·¸ì¸ ì±ê³µ â ì´ëë¯¼ ëìë³´ëë¡
        window.location.href = '/admin/dashboard'
      } else {
        setError(data.error || 'ë¡ê·¸ì¸ì ì¤í¨íìµëë¤.')
      }
    } catch (error) {
      console.error('[ì´ëë¯¼ ë¡ê·¸ì¸] ìì¸:', error)
      setError('ë¡ê·¸ì¸ ì¤ ì¤ë¥ê° ë°ìíìµëë¤.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center p-6">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* í¤ë */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-900/50 rounded-full mb-4">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">ì´ëë¯¼ ë¡ê·¸ì¸</h1>
          <p className="text-slate-400 mt-2">BandAuto ì´ëë¯¼ í¨ë</p>
        </div>

        {/* ì´ëë¯¼ ìë´ */}
        <div className="bg-indigo-900/30 border border-indigo-700/50 text-indigo-300 px-4 py-3 rounded-lg mb-6 text-sm">
          ì´ëë¯¼ ê¶íì´ íìí©ëë¤. ì´ëë¯¼ ê³ì ì¼ë¡ ë¡ê·¸ì¸í´ì£¼ì¸ì.
        </div>

        {/* ìë¬ ë©ìì§ */}
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* ë¡ê·¸ì¸ í¼ */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              ì´ë©ì¼
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@email.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              ë¹ë°ë²í¸
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="ë¹ë°ë²í¸ë¥¼ ìë ¥íì¸ì"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'ë¡ê·¸ì¸ ì¤...' : 'ì´ëë¯¼ ë¡ê·¸ì¸'}
          </button>
        </form>

        {/* íë¨ ë§í¬ */}
        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm text-slate-400 hover:text-slate-300 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            íë§¤ê´ë¦¬ì ë¡ê·¸ì¸ì¼ë¡ ëìê°ê¸°
          </a>
        </div>
      </div>
    </div>
  )
}
