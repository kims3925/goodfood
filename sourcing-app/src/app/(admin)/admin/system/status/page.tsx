'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  Server,
  Database,
  Wifi,
  HardDrive,
  Cpu,
  MemoryStick,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

interface ServiceHealth {
  name: string
  type: 'app' | 'database' | 'cache' | 'external'
  status: 'healthy' | 'warning' | 'error'
  uptime: string
  latency: number
  details: string
}

export default function SystemStatusPage() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: 'Shop App', type: 'app', status: 'healthy', uptime: '7d 14h', latency: 45, details: 'Next.js 14.2.3 | 포트 3000' },
    { name: 'Sourcing App', type: 'app', status: 'healthy', uptime: '7d 14h', latency: 38, details: 'Next.js 14.2.3 | 포트 3001' },
    { name: 'MariaDB', type: 'database', status: 'healthy', uptime: '30d 2h', latency: 2, details: 'v10.11 | 47 models | sourcing_db' },
    { name: 'Redis', type: 'cache', status: 'healthy', uptime: '30d 2h', latency: 1, details: 'v7-alpine | AOF 활성 | Bull Queue' },
    { name: 'Band API', type: 'external', status: 'healthy', uptime: '-', latency: 120, details: 'openapi.band.us | Rate Limited' },
    { name: 'Toss Payments', type: 'external', status: 'healthy', uptime: '-', latency: 95, details: '결제 처리 | 웹훅 연동' },
    { name: 'Gemini AI', type: 'external', status: 'healthy', uptime: '-', latency: 850, details: 'gemini-1.5-flash | 상품 AI 변환' },
  ])
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const refresh = () => {
    setLastRefresh(new Date())
  }

  const typeLabels: Record<string, string> = {
    app: '애플리케이션',
    database: '데이터베이스',
    cache: '캐시',
    external: '외부 서비스',
  }

  const groupedServices = services.reduce((acc, service) => {
    if (!acc[service.type]) acc[service.type] = []
    acc[service.type].push(service)
    return acc
  }, {} as Record<string, ServiceHealth[]>)

  const allHealthy = services.every(s => s.status === 'healthy')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Activity className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">서비스 상태</h1>
              <p className="text-gray-600">전체 시스템 헬스체크 모니터링</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              allHealthy ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {allHealthy ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {allHealthy ? '전체 정상' : '일부 주의'}
            </div>
            <button
              onClick={refresh}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title="새로고침"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Service Groups */}
      {Object.entries(groupedServices).map(([type, typeServices]) => (
        <div key={type} className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase px-1">{typeLabels[type]}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {typeServices.map(service => (
              <div key={service.name} className="bg-white rounded-lg shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {service.status === 'healthy' ? (
                      <CheckCircle size={18} className="text-green-500" />
                    ) : service.status === 'warning' ? (
                      <AlertCircle size={18} className="text-yellow-500" />
                    ) : (
                      <AlertCircle size={18} className="text-red-500" />
                    )}
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    service.status === 'healthy' ? 'bg-green-100 text-green-700' :
                    service.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {service.status === 'healthy' ? '정상' : service.status === 'warning' ? '주의' : '오류'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3">{service.details}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {service.uptime !== '-' && <span>업타임: {service.uptime}</span>}
                  <span>응답: {service.latency}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="text-center text-xs text-gray-400 py-4">
        마지막 확인: {lastRefresh.toLocaleString('ko-KR')}
      </div>
    </div>
  )
}
