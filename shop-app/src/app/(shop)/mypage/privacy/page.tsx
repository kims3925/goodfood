'use client'

export default function PrivacyPolicyPage() {
  return (
    <div className="kurly-container py-12">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
          <p className="text-gray-600">ABC마켓은 고객님의 개인정보를 소중히 여깁니다</p>
        </div>

        {/* 내용 */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. 개인정보의 수집 및 이용목적</h2>
            <p className="text-gray-700 leading-relaxed">
              ABC마켓은 다음의 목적을 위하여 개인정보를 처리합니다. 처리한 개인정보는 다음의 목적 이외의 용도로는 사용되지 않으며 이용 목적이 변경될 시에는 사전동의를 구할 예정입니다.
            </p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>• 회원가입 및 관리: 회원 가입의사 확인, 회원제 서비스 제공, 본인 확인</li>
              <li>• 재화 또는 서비스 제공: 물품 배송, 서비스 제공, 청구서 발송, 요금 결제</li>
              <li>• 마케팅 및 광고에의 활용: 이벤트 및 광고성 정보 제공 및 참여기회 제공</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">2. 수집하는 개인정보의 항목</h2>
            <p className="text-gray-700 leading-relaxed">
              회사는 회원가입, 상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.
            </p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>• 필수항목: 이름, 이메일, 전화번호, 주소</li>
              <li>• 선택항목: 생년월일, 성별</li>
              <li>• 자동수집항목: 서비스 이용기록, 접속 로그, 쿠키, 접속 IP 정보</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">3. 개인정보의 보유 및 이용기간</h2>
            <p className="text-gray-700 leading-relaxed">
              회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집시에 동의 받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>• 계약 또는 청약철회 등에 관한 기록: 5년</li>
              <li>• 대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
              <li>• 소비자의 불만 또는 분쟁처리에 관한 기록: 3년</li>
              <li>• 표시·광고에 관한 기록: 6개월</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. 개인정보의 제3자 제공</h2>
            <p className="text-gray-700 leading-relaxed">
              회사는 원칙적으로 이용자의 개인정보를 제1조(개인정보의 수집 및 이용목적)에서 명시한 범위 내에서 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">5. 정보주체의 권리·의무 및 행사방법</h2>
            <p className="text-gray-700 leading-relaxed">
              정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
            </p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>• 개인정보 열람 요구</li>
              <li>• 오류 등이 있을 경우 정정 요구</li>
              <li>• 삭제 요구</li>
              <li>• 처리정지 요구</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">6. 개인정보 보호책임자</h2>
            <div className="bg-gray-50 p-6 rounded-lg mt-4">
              <p className="text-gray-700 mb-2"><strong>개인정보 보호책임자</strong></p>
              <p className="text-gray-600">성명: 홍길동</p>
              <p className="text-gray-600">직책: 개인정보보호팀장</p>
              <p className="text-gray-600">연락처: 1234-5678</p>
              <p className="text-gray-600">이메일: privacy@abc-market.com</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">7. 개인정보 처리방침 변경</h2>
            <p className="text-gray-700 leading-relaxed">
              이 개인정보처리방침은 2024년 1월 1일부터 적용됩니다. 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
