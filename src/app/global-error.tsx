'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              marginBottom: '1rem'
            }}>
              시스템 오류가 발생했습니다
            </h2>
            
            <p style={{
              color: '#6b7280',
              marginBottom: '2rem'
            }}>
              죄송합니다. 예기치 않은 시스템 오류가 발생했습니다.
            </p>
            
            <button
              onClick={() => reset()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}