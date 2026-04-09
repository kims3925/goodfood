'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function CollectedProductRedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  useEffect(() => {
    const openRegister = searchParams.get('openRegister') === 'true'
    const target = openRegister
      ? '/sourcing/product/list?openRegister=true'
      : '/sourcing/product/list'
    router.replace(target)
  }, [router, searchParams])
  return null
}

export default function CollectedProductRedirect() {
  return (
    <Suspense fallback={null}>
      <CollectedProductRedirectContent />
    </Suspense>
  )
}
