# Toss Payments 결제위젯 연동 가이드 (Next.js + TypeScript 기준)

> 결제 **위젯**(Payment Widget)으로, 주문서 화면 안에 결제 UI를 직접 임베딩하는 방식입니다.  
> 예시는 Next.js(App Router) + TypeScript 기준으로 작성했습니다.

---

## 1. 전체 흐름 개요

1. **고객이 결제 페이지 진입**
   - 서버(`/api/payments/prepare`)에 결제 준비 요청
   - 서버가 `orderId`, `amount`, `orderName` 등을 생성 후 반환 + DB 저장

2. **프론트에서 결제위젯 렌더링**
   - Toss JS SDK 로드 후 `TossPayments(widgetClientKey)` 초기화 :contentReference[oaicite:0]{index=0}  
   - `tossPayments.widgets({ customerKey })` 호출  
   - `widgets.setAmount()` 으로 금액 설정 후 `widgets.renderPaymentMethods()` 렌더링 :contentReference[oaicite:1]{index=1}  
   - `widgets.renderAgreement()` 로 약관 영역 렌더링(선택)

3. **결제 버튼 클릭 → `widgets.requestPayment()`**
   - `orderId`, `orderName`, `successUrl`, `failUrl` 등 전달 :contentReference[oaicite:2]{index=2}  
   - Toss 결제창이 뜨고, 완료 시 `successUrl`로 리다이렉트

4. **성공 콜백 페이지에서 승인 처리**
   - `successUrl?paymentKey=...&orderId=...&amount=...`
   - 서버(`/api/payments/confirm`)에서 `paymentKey`로 Toss `/v1/payments/confirm` 호출하여 최종 승인 :contentReference[oaicite:3]{index=3}  

---

## 2. SDK & API 키 준비

1. 토스페이먼츠 콘솔에서 **결제위젯 연동 키(widget client key)**, **secret key** 를 발급 받습니다. :contentReference[oaicite:4]{index=4}  
2. 상점 관리자에서 **결제위젯 UI**를 만들고, 필요하다면 `variantKey`를 확인합니다. (UI 여러 개일 때) :contentReference[oaicite:5]{index=5}  

---

## 3. 환경 변수 설정 (.env)

```bash
# 프론트에서 사용할 위젯용 client key
NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY=widget_client_key_여기에

# 서버에서 사용할 secret key (절대 프론트에 노출 금지)
TOSS_SECRET_KEY=secret_key_여기에

# Redirect URL
TOSS_SUCCESS_URL=http://localhost:3000/payments/success
TOSS_FAIL_URL=http://localhost:3000/payments/fail
결제 준비 API (orderId 생성)

역할: 프론트가 호출해서 orderId, amount, orderName 등의 정보를 받아감

src/app/api/payments/prepare/route.ts

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { amount, orderName, customerName, customerEmail } = await req.json()

    // 1) 주문번호 생성 (무작위 고유값)
    const orderId = 'ORDER-' + crypto.randomBytes(8).toString('hex')

    // 2) DB에 주문 정보 저장 (여기서는 예시라 생략)
    // await prisma.order.create({ data: { orderId, amount, orderName, customerName, status: 'READY' } })

    // 3) 프론트에 내려줄 데이터
    return NextResponse.json({
      success: true,
      data: {
        orderId,
        amount,
        orderName,
        customerName,
        customerEmail,
        successUrl: process.env.TOSS_SUCCESS_URL,
        failUrl: process.env.TOSS_FAIL_URL
      }
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { success: false, message: '결제 준비 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

5. 결제 승인 API (결제 완료 처리)

역할: successUrl 에서 받은 paymentKey, orderId, amount 로 토스 결제 승인 API 호출

src/app/api/payments/confirm/route.ts

import { NextRequest, NextResponse } from 'next/server'

const secretKey = process.env.TOSS_SECRET_KEY!

export async function POST(req: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await req.json()

    // 1) 서버 DB에 저장된 주문금액과 비교 검증 (예시 코드)
    // const order = await prisma.order.findUnique({ where: { orderId } })
    // if (!order || order.amount !== amount) {
    //   return NextResponse.json(
    //     { success: false, message: '결제 금액이 일치하지 않습니다.' },
    //     { status: 400 }
    //   )
    // }

    // 2) Toss Payments 승인 API 호출
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`${secretKey}:`).toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Toss confirm error:', data)
      return NextResponse.json(
        { success: false, message: data.message ?? '결제 승인 실패' },
        { status: 400 }
      )
    }

    // 3) 승인 성공 시 주문 상태 업데이트
    // await prisma.order.update({ where: { orderId }, data: { status: 'PAID' } })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { success: false, message: '결제 승인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

6. 결제 페이지 (결제위젯 렌더링)

실제로 위젯 UI를 페이지에 띄우는 코드입니다.

6-1. 타입 선언 (global.d.ts)

window.TossPayments 전역을 TypeScript 에서 인식하도록 선언합니다.

src/global.d.ts (또는 types/global.d.ts 등)

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => any
  }
}

export {}

6-2. 결제 페이지 컴포넌트

src/app/payments/checkout/page.tsx

'use client'

import { useEffect, useState, useCallback } from 'react'
import Script from 'next/script'

interface PrepareResponse {
  orderId: string
  amount: number
  orderName: string
  customerName: string
  customerEmail: string
  successUrl: string
  failUrl: string
}

const widgetClientKey = process.env.NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY!

// 구매자 식별용 ID (실서비스에서는 로그인 사용자 ID 등을 사용하고, 충분히 랜덤/유추 불가해야 함)
const CUSTOMER_KEY = 'customer_' + Math.random().toString(36).slice(2)

export default function CheckoutPage() {
  const [payInfo, setPayInfo] = useState<PrepareResponse | null>(null)
  const [widgets, setWidgets] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // 1) 결제 준비 API 호출
  useEffect(() => {
    const prepare = async () => {
      try {
        const res = await fetch('/api/payments/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 10000,
            orderName: '테스트 상품 결제',
            customerName: '홍길동',
            customerEmail: 'test@example.com'
          })
        })
        const json = await res.json()
        if (!json.success) {
          alert('결제 준비 실패: ' + json.message)
          return
        }
        setPayInfo(json.data)
      } catch (e) {
        console.error(e)
        alert('결제 준비 중 오류 발생')
      } finally {
        setLoading(false)
      }
    }

    prepare()
  }, [])

  // 2) TossPayments SDK 로드 후 위젯 초기화
  const handleScriptLoad = useCallback(async () => {
    if (!window.TossPayments) {
      console.error('TossPayments is not loaded')
      return
    }
    if (!payInfo) return

    // TossPayments SDK 초기화
    const tossPayments = window.TossPayments(widgetClientKey)

    // 위젯 객체 생성
    const widgetsInstance = tossPayments.widgets({
      customerKey: CUSTOMER_KEY
    })

    // 금액 설정
    await widgetsInstance.setAmount({
      currency: 'KRW',
      value: payInfo.amount
    })

    // 결제수단 UI 렌더링 (variantKey는 필요시 어드민에서 가져와서 사용)
    await widgetsInstance.renderPaymentMethods(
      {
        selector: '#payment-widget',
        variantKey: 'DEFAULT' // 여러 UI 만든 경우, 해당 UI의 variantKey 사용
      }
    )

    // 약관 UI 렌더링 (선택)
    await widgetsInstance.renderAgreement({
      selector: '#agreement',
      variantKey: 'DEFAULT'
    })

    setWidgets(widgetsInstance)
  }, [payInfo])

  // 3) 결제 요청
  const handleRequestPayment = async () => {
    if (!widgets || !payInfo) return

    try {
      await widgets.requestPayment({
        orderId: payInfo.orderId,
        orderName: payInfo.orderName,
        successUrl: payInfo.successUrl,
        failUrl: payInfo.failUrl,
        customerName: payInfo.customerName,
        customerEmail: payInfo.customerEmail,
        // 필요 시 전화번호, metadata 등 추가 가능
      })
      // Redirect 방식이라 여기까지 오지 않고 페이지 이동됨
    } catch (error: any) {
      // Promise 방식 에러 핸들링 (PC 등에서만 가능)
      console.error(error)
      if (error.code === 'USER_CANCEL') {
        alert('사용자에 의해 결제가 취소되었습니다.')
      } else {
        alert('결제 요청 중 오류가 발생했습니다.')
      }
    }
  }

  return (
    <main className="p-6 max-w-lg mx-auto space-y-6">
      {/* Toss SDK Script */}
      <Script
        src="https://js.tosspayments.com/v1/payment-widget"
        onLoad={handleScriptLoad}
      />

      <h1 className="text-2xl font-bold">결제 페이지</h1>

      {loading || !payInfo ? (
        <div>결제 정보를 준비 중입니다...</div>
      ) : (
        <>
          <section className="space-y-2">
            <div>주문명: {payInfo.orderName}</div>
            <div>금액: {payInfo.amount.toLocaleString()}원</div>
            <div>구매자: {payInfo.customerName}</div>
          </section>

          {/* 결제위젯이 렌더링될 영역 */}
          <div id="payment-widget" className="border rounded p-4" />

          {/* 약관 위젯이 렌더링될 영역 */}
          <div id="agreement" className="border rounded p-4 mt-4" />

          <button
            onClick={handleRequestPayment}
            className="mt-4 px-4 py-2 bg-black text-white rounded"
          >
            결제하기
          </button>
        </>
      )}
    </main>
  )
}


🔎 Script에서 사용하는 경로
<script src="https://js.tosspayments.com/v1/payment-widget"></script> 는 토스 공식 문서/예제에서 사용하는 결제위젯 SDK 경로입니다. 
토스 위키피디아

7. 결제 성공 콜백 페이지

src/app/payments/success/page.tsx

'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'fail'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey')
    const orderId = searchParams.get('orderId')
    const amount = searchParams.get('amount')

    if (!paymentKey || !orderId || !amount) {
      setStatus('fail')
      setMessage('필수 결제 정보가 누락되었습니다.')
      return
    }

    const confirm = async () => {
      try {
        const res = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount)
          })
        })
        const json = await res.json()
        if (json.success) {
          setStatus('success')
          setMessage('결제가 정상적으로 완료되었습니다.')
        } else {
          setStatus('fail')
          setMessage(json.message ?? '결제 승인에 실패했습니다.')
        }
      } catch (e) {
        console.error(e)
        setStatus('fail')
        setMessage('결제 승인 처리 중 오류가 발생했습니다.')
      }
    }

    confirm()
  }, [searchParams])

  if (status === 'loading') {
    return <div>결제 승인 처리 중입니다...</div>
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        {status === 'success' ? '결제 성공' : '결제 실패'}
      </h1>
      <p>{message}</p>
    </main>
  )
}

8. 체크리스트

 API 키

 NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY (위젯용 client key)

 TOSS_SECRET_KEY (서버용 secret key)

 Redirect URL

 콘솔에 TOSS_SUCCESS_URL, TOSS_FAIL_URL 과 동일하게 등록

 결제 준비 API에서 orderId, amount 를 DB에 저장

 승인 API에서 Toss /v1/payments/confirm 호출 시, DB에 저장된 금액과 비교 검증

 테스트 모드에서 여러 케이스(성공/실패/취소) 확인 후 라이브 전환