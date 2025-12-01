# Alert/Confirm 개선 TODO 리스트

> 모든 브라우저 기본 `alert()`와 `confirm()` 호출을 커스텀 Toast/Modal 컴포넌트로 교체

## 개선 방향
- **alert()** → Toast 알림 (react-hot-toast 또는 커스텀 Toast 컴포넌트)
- **confirm()** → 커스텀 확인 Modal 컴포넌트

---

## 📋 Alert() 개선 목록 (13건)

### 밴드 관리 페이지 ✅
**파일**: `sourcing-app/src/app/(admin)/band/page.tsx`

- [x] **밴드 삭제 실패 알림**
  - 위치: 밴드 삭제 API 에러 핸들링
  - 현재: `alert('밴드 삭제에 실패했습니다.')`
  - 개선: Toast.error 로 변경

- [x] **밴드 저장 성공 알림**
  - 위치: 밴드 저장/수정 완료 후
  - 현재: `alert('밴드가 저장되었습니다.')`
  - 개선: Toast.success 로 변경

- [x] **밴드 저장 실패 알림**
  - 위치: 밴드 저장 API 에러 핸들링
  - 현재: `alert('밴드 저장에 실패했습니다.')`
  - 개선: Toast.error 로 변경

---

### 상품 목록 페이지 ✅
**파일**: `sourcing-app/src/app/(admin)/product/list/page.tsx`

- [x] **일괄 삭제 실패 알림**
  - 위치: 선택된 상품 일괄 삭제 에러 핸들링
  - 현재: `alert('상품 삭제에 실패했습니다.')`
  - 개선: Toast.error 로 변경

---

### 발행 상품 관리 페이지 ✅
**파일**: `sourcing-app/src/app/(admin)/product/publish/page.tsx`

- [x] **발행 취소 실패 알림**
  - 위치: 발행 취소 API 에러 핸들링
  - 현재: `alert('발행 취소에 실패했습니다.')`
  - 개선: Toast.error 로 변경

---

### 소매밴드 발행 페이지 ✅
**파일**: `sourcing-app/src/app/(admin)/publish/retail-band/page.tsx`

- [x] **상품 미선택 알림**
  - 위치: 발행 시 상품 선택 검증
  - 현재: `alert('발행할 상품을 선택해주세요.')`
  - 개선: Toast.warning 로 변경

- [x] **밴드 미선택 알림**
  - 위치: 발행 시 밴드 선택 검증
  - 현재: `alert('발행할 밴드를 선택해주세요.')`
  - 개선: Toast.warning 로 변경

- [x] **발행 성공 알림**
  - 위치: 발행 완료 후
  - 현재: `alert('발행이 완료되었습니다.')`
  - 개선: Toast.success 로 변경

- [x] **발행 실패 알림**
  - 위치: 발행 API 에러 핸들링
  - 현재: `alert('발행에 실패했습니다.')`
  - 개선: Toast.error 로 변경

---

### 정책 관리 페이지 ✅
**파일**: `sourcing-app/src/app/(admin)/policy/list/page.tsx`

- [x] **정책 저장 성공 알림**
  - 위치: 정책 저장/수정 완료 후
  - 현재: `alert('정책이 저장되었습니다.')`
  - 개선: Toast.success 로 변경

- [x] **정책 저장 실패 알림**
  - 위치: 정책 저장 API 에러 핸들링
  - 현재: `alert('정책 저장에 실패했습니다.')`
  - 개선: Toast.error 로 변경

- [x] **정책 삭제 실패 알림**
  - 위치: 정책 삭제 API 에러 핸들링
  - 현재: `alert('정책 삭제에 실패했습니다.')`
  - 개선: Toast.error 로 변경

---

### 주문 목록 페이지 ✅
**파일**: `sourcing-app/src/app/(admin)/order/list/page.tsx`

- [x] **주문 상태 변경 실패 알림**
  - 위치: 주문 상태 변경 API 에러 핸들링
  - 현재: `alert('주문 상태 변경에 실패했습니다.')`
  - 개선: Toast.error 로 변경

---

## 📋 Confirm() 개선 목록 (20건)

### 밴드 관리 페이지 ✅
**파일**: `sourcing-app/src/app/(admin)/band/page.tsx`

- [x] **밴드 삭제 확인**
  - 위치: 밴드 삭제 버튼 클릭
  - 현재: `confirm('정말 이 밴드를 삭제하시겠습니까?')`
  - 개선: ConfirmModal로 변경

---

### 상품 목록 페이지 ✅
**파일**: `sourcing-app/src/app/(admin)/product/list/page.tsx`

- [x] **개별 상품 삭제 확인**
  - 위치: 상품 행 삭제 버튼 클릭
  - 현재: `confirm('이 상품을 삭제하시겠습니까?')`
  - 개선: ConfirmModal로 변경

- [x] **선택 상품 일괄 삭제 확인**
  - 위치: 일괄 삭제 버튼 클릭
  - 현재: `confirm('선택한 N개 상품을 삭제하시겠습니까?')`
  - 개선: ConfirmModal로 변경

---

### 발행 상품 관리 페이지 ✅
**파일**: `sourcing-app/src/app/(admin)/product/publish/page.tsx`

- [x] **발행 취소 확인**
  - 위치: 발행 취소 버튼 클릭
  - 현재: `confirm('발행을 취소하시겠습니까?')`
  - 개선: ConfirmModal로 변경

- [x] **일괄 발행 취소 확인**
  - 위치: 일괄 발행 취소 버튼 클릭
  - 현재: `confirm('선택한 N개 상품의 발행을 취소하시겠습니까?')`
  - 개선: ConfirmModal로 변경

---

### 소매밴드 발행 페이지 ✅
**파일**: `sourcing-app/src/app/(admin)/publish/retail-band/page.tsx`

- [x] **발행 확인**
  - 위치: 발행 버튼 클릭
  - 현재: `confirm('선택한 상품을 발행하시겠습니까?')`
  - 개선: 발행 확인 Modal (이미 구현됨)

---

### 정책 관리 페이지
**파일**: `sourcing-app/src/app/(admin)/policy/list/page.tsx`

- [ ] **정책 삭제 확인**
  - 위치: 정책 삭제 버튼 클릭
  - 현재: `confirm('이 정책을 삭제하시겠습니까?')`
  - 개선: ConfirmModal로 변경

---

### 주문 목록 페이지
**파일**: `sourcing-app/src/app/(admin)/order/list/page.tsx`

- [ ] **주문 상태 변경 확인** (다수)
  - 위치: 주문 상태 변경 드롭다운
  - 현재: `confirm('주문 상태를 변경하시겠습니까?')`
  - 개선: 상태 변경 확인 Modal로 변경 (현재 상태 → 변경 상태 표시)

- [ ] **일괄 상태 변경 확인**
  - 위치: 선택 주문 일괄 상태 변경
  - 현재: `confirm('선택한 N개 주문의 상태를 변경하시겠습니까?')`
  - 개선: 확인 Modal로 변경

---

### 정산 관리 페이지
**파일**: `sourcing-app/src/app/(admin)/settlement/list/page.tsx`

- [ ] **정산 확정 확인**
  - 위치: 정산 확정 버튼 클릭
  - 현재: `confirm('정산을 확정하시겠습니까?')`
  - 개선: 확인 Modal로 변경 (정산 금액 표시)

---

### 자동화 설정 페이지
**파일**: `sourcing-app/src/app/(admin)/automation/settings/page.tsx`

- [ ] **자동화 설정 저장 확인**
  - 위치: 설정 저장 버튼 클릭
  - 현재: `confirm('자동화 설정을 저장하시겠습니까?')`
  - 개선: 확인 Modal로 변경

- [ ] **자동화 설정 초기화 확인**
  - 위치: 초기화 버튼 클릭
  - 현재: `confirm('설정을 초기화하시겠습니까?')`
  - 개선: 위험 동작 확인 Modal로 변경 (빨간색 강조)

---

### API 설정 페이지
**파일**: `sourcing-app/src/app/(admin)/admin/settings/api/page.tsx`

- [ ] **API 키 삭제 확인**
  - 위치: API 키 삭제 버튼 클릭
  - 현재: `confirm('API 키를 삭제하시겠습니까?')`
  - 개선: 위험 동작 확인 Modal로 변경

---

### AI 설정 페이지
**파일**: `sourcing-app/src/app/(admin)/admin/settings/ai/page.tsx`

- [ ] **AI 설정 초기화 확인**
  - 위치: 초기화 버튼 클릭
  - 현재: `confirm('AI 설정을 초기화하시겠습니까?')`
  - 개선: 위험 동작 확인 Modal로 변경

---

## 🛠️ 구현 계획

### 1단계: 공통 컴포넌트 생성 ✅
- [x] Toast 컴포넌트 (이미 존재: `components/ui/Toast.tsx`)
- [x] ConfirmModal 컴포넌트 생성 (`components/ui/ConfirmModal.tsx`)
  - props: title, message, confirmText, cancelText, onConfirm, onCancel, variant (danger/warning/info)

### 2단계: Alert → Toast 변경 (13건) ✅
- [x] 밴드 관리 페이지 (3건)
- [x] 상품 목록 페이지 (1건)
- [x] 발행 상품 관리 페이지 (1건)
- [x] 소매밴드 발행 페이지 (4건)
- [x] 정책 관리 페이지 (3건)
- [x] 주문 목록 페이지 (1건)

### 3단계: Confirm → Modal 변경 (14건) - 미진행
- [x] 밴드 관리 페이지 (1건)
- [x] 상품 목록 페이지 (2건)
- [x] 발행 상품 관리 페이지 (1건)
- [x] 소매밴드 발행 페이지 (1건) - 이미 Modal 사용중
- [ ] 정책 관리 페이지 (1건)
- [ ] 주문 목록 페이지 (2건)
- [ ] 정산 관리 페이지 (1건)
- [ ] 자동화 설정 페이지 (2건)
- [ ] API 설정 페이지 (1건)
- [ ] AI 설정 페이지 (1건)

---

## 📊 진행 현황

| 카테고리 | 총 개수 | 완료 | 진행률 |
|---------|--------|-----|-------|
| Alert (Toast)  | 13     | 13  | 100%  |
| Confirm (Modal)| 14     | 5   | 36%   |
| **합계**| **27** | 18  | 67%   |

---

## 📅 마지막 업데이트
- 2025-12-01: 모든 페이지 Toast 적용 완료 (Alert 100%)
- 2025-12-01: 밴드 관리, 상품 목록, 발행 상품 관리 페이지 ConfirmModal 적용
- 2025-12-01: 초기 TODO 리스트 생성
