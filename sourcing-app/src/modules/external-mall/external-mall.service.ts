/**
 * 외부 쇼핑몰 커넥터 팩토리 (작업지시서 §7-3).
 * DB ExternalMallConnection 레코드 → 적절한 커넥터 인스턴스 생성.
 *
 * 시나리오 A 범위 (현재): CAFE24 만 활성. OWNERCLAN/SHOPIFY/CUSTOM_API 는
 * 후속 Phase 에서 구현 (지금은 명확한 에러 반환).
 */

import { Cafe24Connector } from './connectors/cafe24.connector'
import type { ExternalMallConnector } from './types'

interface ConnectionLike {
  platform: string
  mallId?: string | null
  apiBaseUrl?: string | null
  apiKey?: string | null
  apiSecret?: string | null
  accessToken?: string | null
  refreshToken?: string | null
  sourcingConfig?: any
  checkoutConfig?: any
}

export class ConnectorFactory {
  static create(connection: ConnectionLike): ExternalMallConnector {
    switch (connection.platform) {
      case 'CAFE24':
        if (!connection.mallId) throw new Error('CAFE24: mallId 가 필요합니다.')
        if (!connection.accessToken) throw new Error('CAFE24: accessToken 미발급')
        return new Cafe24Connector({
          mallId: connection.mallId,
          accessToken: connection.accessToken,
        })

      case 'OWNERCLAN':
        throw new Error('오너클랜 커넥터는 후속 Phase 에서 활성화됩니다.')

      case 'SHOPIFY':
        throw new Error('Shopify 커넥터는 후속 Phase 에서 활성화됩니다.')

      case 'NAVER_STORE':
        throw new Error('스마트스토어 커넥터는 후속 Phase 에서 활성화됩니다.')

      case 'CUSTOM_API':
        throw new Error('CustomApi 커넥터는 후속 Phase 에서 활성화됩니다.')

      default:
        throw new Error(`지원하지 않는 platform: ${connection.platform}`)
    }
  }
}
