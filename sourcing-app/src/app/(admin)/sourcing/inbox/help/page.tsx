/**
 * AI 채팅 — 운영 매뉴얼 페이지
 * 알림 관리/에스컬레이션 룰/운영 흐름 안내.
 */
'use client'

import Link from 'next/link'
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  MessageSquare,
  Bot,
  Settings,
  Clock,
  ShieldAlert,
  Send,
  Eye,
} from 'lucide-react'

export default function InboxHelpPage() {
  return (
    <div className="p-6 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-500" />
          AI 채팅 운영 매뉴얼
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          알림 관리·에스컬레이션·자동 주문이 어떻게 동작하는지 한눈에 파악하세요.
        </p>
      </header>

      {/* 0. 빠른 시작 */}
      <Section title="🚀 빠른 시작 (3단계)">
        <ol className="space-y-3 text-sm">
          <Step n={1} title="Claude API 키 등록">
            <Link
              href="/sourcing/settings/ai"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              AI / API 설정 <ArrowRight className="w-3 h-3" />
            </Link>{' '}
            페이지에서 본인 Claude API 키를 등록해야 AI 분류·응답이 동작합니다. 미등록 시 인박스
            UI 는 보이지만 AI 호출만 400 에러를 냅니다 (셀러별 독립 키).
          </Step>
          <Step n={2} title="자동응답 설정 검토">
            <Link
              href="/sourcing/inbox/settings"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              자동응답 설정 <ArrowRight className="w-3 h-3" />
            </Link>{' '}
            에서 12개 의도별 ON/OFF 를 검토합니다. 처음에는{' '}
            <strong>모두 OFF</strong> 로 두고 1주일간 AI 응답 품질만 검토하는 것을 권장합니다.
          </Step>
          <Step n={3} title="실제 메시지 검증">
            <Link
              href="/sourcing/inbox"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              통합 인박스 <ArrowRight className="w-3 h-3" />
            </Link>{' '}
            에서 &quot;테스트 메시지&quot; 버튼으로 다양한 시나리오를 입력해 분류·응답 품질을 확인하세요.
          </Step>
        </ol>
      </Section>

      {/* 1. 알림이 어디서 어떻게 생성되는가 */}
      <Section title="🔔 알림이 어디서 어떻게 생성되는가">
        <div className="space-y-4 text-sm">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-2">🛎️ 알림 생성 트리거 2가지</p>
            <ul className="space-y-2 list-disc list-inside text-blue-800">
              <li>
                <strong>에스컬레이션 알림</strong> — AI 가{' '}
                <code className="bg-white px-1 rounded">isEscalated=true</code> 로 판단할 때
                <span className="text-blue-700">
                  {' '}
                  (Notification type=INQUIRY)
                </span>
              </li>
              <li>
                <strong>자동 주문 알림</strong> — ORDER 의도 + 신뢰도 ≥ 0.7 + 상품 매칭 성공 시
                GuestOrder PENDING 자동 생성
                <span className="text-blue-700"> (Notification type=ORDER)</span>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-semibold mb-2">📍 알림 표시 위치</p>
            <table className="w-full border border-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-3 py-2 text-left">위치</th>
                  <th className="border px-3 py-2 text-left">URL</th>
                  <th className="border px-3 py-2 text-left">표시 내용</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-3 py-2">매니저 알림 페이지</td>
                  <td className="border px-3 py-2 font-mono">/sourcing/notification</td>
                  <td className="border px-3 py-2">
                    INQUIRY/ORDER/COLLECT/PUBLISH 등 sourcing 섹션 알림 일괄
                  </td>
                </tr>
                <tr>
                  <td className="border px-3 py-2">알림 클릭 → 메시지 직행</td>
                  <td className="border px-3 py-2 font-mono">
                    /sourcing/inbox?messageId=N
                  </td>
                  <td className="border px-3 py-2">
                    딥링크로 해당 스레드 자동 선택
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* 2. 에스컬레이션 룰 */}
      <Section title="⚠️ 에스컬레이션 룰 5종">
        <p className="text-sm text-gray-600 mb-3">
          아래 조건 중 하나라도 충족되면 메시지가 자동으로 사장님 검토 상태(에스컬레이션)로
          전환되고 알림이 생성됩니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <RuleCard
            color="red"
            title="의도 강제"
            body="RETURN, COMPLAINT 의도는 항상 에스컬레이션. 사장님이 직접 처리해야 안전합니다."
          />
          <RuleCard
            color="orange"
            title="신뢰도 < 60%"
            body="AI 가 의도 분류를 확신하지 못함. 임의 응답으로 고객 혼란 방지."
          />
          <RuleCard
            color="yellow"
            title="고액 주문 ≥ 5만원"
            body="AI 자동 주문 생성은 진행하되 사장님 확인 알림 발송 (검증 목적)."
          />
          <RuleCard
            color="purple"
            title="반복 질문 3회+"
            body="같은 발신자가 여러 번 질문 → AI 가 해결 불가로 판단."
          />
          <RuleCard
            color="gray"
            title="비속어 감지"
            body="씨발, ㅅㅂ, 좆, 병신, 개새끼 등 → AI 응답 차단 + 사장님 알림."
          />
        </div>
      </Section>

      {/* 3. 자동 주문 생성 */}
      <Section title="🛒 자동 주문 생성 동작">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm space-y-3">
          <p>
            <strong>조건</strong> (모두 충족 시):
          </p>
          <ul className="list-disc list-inside text-yellow-900 space-y-1 ml-2">
            <li>AI 가 의도 = ORDER 로 분류</li>
            <li>분류 신뢰도 ≥ 70%</li>
            <li>메시지에서 productName 추출 성공 + 본인 쇼핑몰의 ShopProduct 매칭 성공</li>
            <li>해당 메시지에 이미 연결된 주문 없음 (중복 방지)</li>
          </ul>
          <p>
            <strong>생성 결과</strong>:
          </p>
          <ul className="list-disc list-inside text-yellow-900 space-y-1 ml-2">
            <li>
              GuestOrder 생성 — 상태=PENDING (입금 대기), 주문번호 형식{' '}
              <code className="bg-white px-1 rounded">XORD-{`{timestamp}`}-{`{rand}`}</code>
            </li>
            <li>InboxMessage.orderId 에 자동 연결</li>
            <li>알림 type=ORDER 로 사장님 알림 (입금 확인 후 PAID 처리 필요)</li>
          </ul>
          <p className="text-xs text-yellow-800 italic">
            ⚠️ 메시지에 수령인 주소가 없어 임시값으로 생성되며, 실제 발송 전에 사장님이
            ShippingAddress 를 별도 입력해야 합니다.
          </p>
        </div>
      </Section>

      {/* 4. 운영 흐름 */}
      <Section title="🔄 일일 운영 흐름">
        <div className="space-y-4 text-sm">
          <FlowRow
            icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
            title="1. 메시지 수집"
            body="현재는 테스트 메시지 + (Phase 2) 밴드 댓글 폴링. 카카오/SMS 는 Phase 3."
          />
          <FlowRow
            icon={<Bot className="w-5 h-5 text-purple-500" />}
            title="2. AI 분류 + 자동 주문"
            body="POST /api/inbox/messages/[id]/classify 호출 → 의도 분류 + 에스컬 판단 + 자동 주문 시도."
          />
          <FlowRow
            icon={<Bell className="w-5 h-5 text-orange-500" />}
            title="3. 알림 생성"
            body="에스컬 또는 자동 주문 시 Notification 생성 → 사장님 매니저 헤더 종 아이콘에 빨간 점."
          />
          <FlowRow
            icon={<Eye className="w-5 h-5 text-gray-500" />}
            title="4. 사장님 검토"
            body="매니저가 종 아이콘 클릭 → 알림 클릭 → /sourcing/inbox?messageId=N 으로 딥링크."
          />
          <FlowRow
            icon={<Send className="w-5 h-5 text-green-500" />}
            title="5. AI 응답 생성 + 발송"
            body='우측 패널에서 "AI 응답 생성" → 검토 후 클립보드 복사 → 채널에 붙여넣기 → "발송완료 표시" 클릭.'
          />
        </div>
      </Section>

      {/* 5. 운영 팁 */}
      <Section title="💡 운영 팁">
        <ul className="text-sm space-y-2 list-disc list-inside">
          <li>
            <strong>1주차 (검증)</strong>: 모든 의도 OFF + 사장님 직접 응대 + AI 추천 응답만 참고
          </li>
          <li>
            <strong>2주차 (반자동)</strong>: GENERAL/INFO/RESTOCK 만 ON — 위험 낮은 응답부터
          </li>
          <li>
            <strong>3주차 (확장)</strong>: PRICE/STOCK/DELIVERY/PAYMENT/DEPOSIT 추가
          </li>
          <li>
            <strong>4주차 (정착)</strong>: ORDER 까지 ON — 단 RETURN/COMPLAINT 는 영구
            &quot;항상 에스컬레이션&quot; 유지 권장
          </li>
          <li>
            응답 지연을 30초~1분으로 설정해야 자연스러움 — 즉시 응답은 봇 티가 남
          </li>
          <li>
            욕설 키워드는 코드에 하드코딩되어 있음 — 추가 차단어 필요 시 개발팀 요청
          </li>
        </ul>
      </Section>

      {/* 6. 트러블슈팅 */}
      <Section title="🔧 트러블슈팅">
        <table className="w-full border border-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-3 py-2 text-left">증상</th>
              <th className="border px-3 py-2 text-left">원인 및 조치</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-3 py-2">&quot;AI 의도 분류&quot; 클릭 시 400 (NO_CLAUDE_CONFIG)</td>
              <td className="border px-3 py-2">
                <Link href="/sourcing/settings/ai" className="text-blue-600 hover:underline">
                  /sourcing/settings/ai
                </Link>{' '}
                에서 Claude API 키 등록. 셀러별 독립 키.
              </td>
            </tr>
            <tr>
              <td className="border px-3 py-2">자동 주문이 생성되지 않음</td>
              <td className="border px-3 py-2">
                productName 추출 실패 또는 ShopProduct 미매칭. 상품명을 포함한 메시지로 재시도.
              </td>
            </tr>
            <tr>
              <td className="border px-3 py-2">알림 종에 빨간 점 안 보임</td>
              <td className="border px-3 py-2">
                알림이 생성됐어도 헤더 종 아이콘 폴링 주기에 따라 1-2분 지연. 새로고침으로 확인.
              </td>
            </tr>
            <tr>
              <td className="border px-3 py-2">에스컬레이션 알림 너무 많이 옴</td>
              <td className="border px-3 py-2">
                자동응답 설정에서 신뢰도 임계값/반복 횟수 조정 (현재 코드 하드코딩, 향후 설정화).
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-200">{title}</h2>
      {children}
    </section>
  )
}

function Step({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
        {n}
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-gray-700 mt-0.5">{children}</div>
      </div>
    </li>
  )
}

function RuleCard({
  color,
  title,
  body,
}: {
  color: 'red' | 'orange' | 'yellow' | 'purple' | 'gray'
  title: string
  body: string
}) {
  const colors: Record<string, string> = {
    red: 'border-red-300 bg-red-50',
    orange: 'border-orange-300 bg-orange-50',
    yellow: 'border-yellow-300 bg-yellow-50',
    purple: 'border-purple-300 bg-purple-50',
    gray: 'border-gray-300 bg-gray-50',
  }
  return (
    <div className={`border rounded-lg p-3 ${colors[color]}`}>
      <div className="font-semibold flex items-center gap-1">
        <ShieldAlert className="w-3 h-3" /> {title}
      </div>
      <div className="mt-1 text-gray-700">{body}</div>
    </div>
  )
}

function FlowRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="shrink-0">{icon}</div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-gray-700 text-xs mt-0.5">{body}</div>
      </div>
    </div>
  )
}
