# e-commerce-app Alert/Confirm 정리 TODO

## 요약
- **alert()**: 1건 -> **완료**
- **confirm()**: 5건 -> **완료**
- **총합**: 6건 -> **전체 완료**

---

## 완료된 작업

### 준비 작업
- [x] Toast 컴포넌트 생성 (`src/modules/common/ui-kit/src/ui/Toast.tsx`)
- [x] ConfirmModal 컴포넌트 생성 (`src/modules/common/ui-kit/src/ui/ConfirmModal.tsx`)
- [x] index.ts에 export 추가
- [x] layout.tsx에 ToastProvider 추가

### alert 변경 (1건)
- [x] `order/band/page.tsx:137` - alert -> toast.info

### confirm 변경 (5건)
- [x] `cart/page.tsx:141` - ConfirmModal (단일 삭제)
- [x] `cart/page.tsx:183` - ConfirmModal (전체 비우기)
- [x] `cart/page.tsx:218` - ConfirmModal (선택 삭제)
- [x] `wishlist/page.tsx:49` - ConfirmModal
- [x] `addresses/page.tsx:139` - ConfirmModal

---

## 변경된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/modules/common/ui-kit/src/ui/Toast.tsx` | 신규 생성 |
| `src/modules/common/ui-kit/src/ui/ConfirmModal.tsx` | 신규 생성 |
| `src/modules/common/ui-kit/src/ui/index.ts` | Toast, ConfirmModal export 추가 |
| `src/app/layout.tsx` | ToastProvider 추가 |
| `src/app/(shop)/order/band/page.tsx` | alert -> useToast |
| `src/app/(shop)/cart/page.tsx` | confirm x3 -> ConfirmModal |
| `src/app/(shop)/mypage/wishlist/page.tsx` | confirm -> ConfirmModal |
| `src/app/(shop)/mypage/addresses/page.tsx` | confirm -> ConfirmModal |

---

## 작업 완료: 2024-12-01
