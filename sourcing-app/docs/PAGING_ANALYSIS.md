# 목록 페이지 필터 + 페이징 통합 적용 설계서

> 목적: 기존 목록 페이지에 **필터 기능**을 추가하고,  
> 필터가 적용된 결과를 기준으로 **전체 건수/페이징 정보를 다시 계산**해서 클라이언트에 전달하는 구조를 정의한다.

---

## 1. 요구사항 정의

1. **필터 조건**
   - 예시 (프로젝트에 맞게 확장/수정 가능)
     - 검색어: `keyword` (제목/내용/작성자 등)
     - 상태: `status` (예: ACTIVE, INACTIVE, DRAFT 등)
     - 날짜 범위: `startDate`, `endDate`
     - 기타 도메인별 필터: `category`, `platform`, `isActive` 등

2. **페이징 조건**
   - 현재 페이지: `page` (1-based)
   - 페이지당 데이터 수: `pageSize`
   - 정렬 옵션(선택): `sortBy`, `sortOrder` (asc/desc)

3. **동작 요구사항**
   - 필터가 변경되면:
     - **해당 필터가 적용된 전체 데이터 개수**를 다시 계산한다.
     - 그 결과를 기반으로 **페이징(총 페이지 수, 현재 페이지)**를 다시 계산한다.
     - 일반적으로 **필터 변경 시 페이지를 1페이지로 리셋**한다.
   - 페이징 이동 시:
     - **기존 필터 조건을 유지**한 상태에서 다음/이전 페이지 조회
   - URL QueryString에 필터/페이징 정보를 유지하여:
     - 새로고침에도 동일한 상태 유지
     - 링크 공유 시 동일한 결과 재현 가능

---

## 2. API 설계

### 2.1. 엔드포인트

- URL (예시): `GET /api/items`
- Query Parameters (예시):

| 파라미터    | 타입   | 설명                              |
|------------|--------|-----------------------------------|
| `page`     | number | 현재 페이지 (default: 1)         |
| `pageSize` | number | 페이지당 데이터 수 (default: 20) |
| `keyword`  | string | 검색어 (optional)                |
| `status`   | string | 상태 필터 (optional)             |
| `startDate`| string | 시작일 (YYYY-MM-DD, optional)    |
| `endDate`  | string | 종료일 (YYYY-MM-DD, optional)    |
| `sortBy`   | string | 정렬 기준 필드 (optional)        |
| `sortOrder`| string | asc / desc (optional)            |

### 2.2. 응답 스펙

```jsonc
{
  "success": true,
  "data": {
    "items": [
      // 현재 페이지에 대한 목록 데이터
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalCount": 153,     // 필터가 적용된 전체 데이터 개수
      "totalPages": 8        // ceil(totalCount / pageSize)
    },
    "filters": {
      "keyword": "샘플",
      "status": "ACTIVE",
      "startDate": "2025-01-01",
      "endDate": "2025-12-31"
    }
  }
}
