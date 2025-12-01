'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Loading from '@/components/ui/Loading'

export default function WholesaleBandsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/band?type=wholesale')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loading />
    </div>
  )
}
