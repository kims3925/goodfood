# Claude AI 협업 가이드

> **프로젝트:** BandAuto - Band 기반 소셜커머스 상품 소싱 및 판매 자동화 플랫폼

---

## 역할

소프트웨어 아키텍처 전문가로서 개발팀과 협업한다.

**핵심 책임:**
- 기술적으로 건전하고, 확장 가능하며, 유지보수 가능한 결정
- 프로젝트 문서 체계 준수 및 일관성 유지
- 코드 품질과 아키텍처 무결성 보장

---

## 빠른 참조

| 상황 | 참조 문서 |
|------|----------|
| 프로젝트 스택 확인 | [docs/PROJECT.md](./docs/PROJECT.md) |
| 네이밍 규칙 확인 | [docs/STRUCTURE.md](./docs/STRUCTURE.md) |
| API 규칙 확인 | [docs/API.md](./docs/API.md) |
| 프론트엔드 규칙 | [docs/FRONTEND.md](./docs/FRONTEND.md) |
| 백엔드 규칙 | [docs/BACKEND.md](./docs/BACKEND.md) |
| DB 규칙 | [docs/DATABASE.md](./docs/DATABASE.md) |
| 테스트 규칙 | [docs/TESTING.md](./docs/TESTING.md) |
| 보안 규칙 | [docs/SECURITY.md](./docs/SECURITY.md) |
| 배포 규칙 | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| 비즈니스 흐름 | [docs/tracking/FLOW.md](./docs/tracking/FLOW.md) |
| 기능 추적 | [docs/tracking/](./docs/tracking/) |

---

## 기술 스택 요약

| 영역 | 기술 |
|-----|-----|
| Framework | Next.js 14.2.3 (App Router) |
| Language | TypeScript 5.9 |
| ORM | Prisma 6.2 |
| Database | MariaDB |
| Auth | NextAuth.js 4.24 (JWT) |
| Payment | Toss Payments |
| AI | Gemini / OpenAI |
| Deploy | AWS EC2, PM2, Jenkins |

---

## 핵심 원칙 (반드시 준수)

```text
1. 문서 먼저 → 코드 나중
2. Soft Delete 기본 (Hard Delete 금지)
3. 트랜잭션 없이 다중 테이블 변경 금지
4. eslint-disable 남용 금지 (useCallback 등으로 해결)
5. 함수형 상태 업데이트 사용 (Stale Closure 방지)
```

---

## Prisma CLI 규칙

```bash
# 반드시 db 폴더에서 --schema prisma 옵션 사용
cd db
npx prisma generate --schema prisma
npx prisma db push --schema prisma
npx prisma studio --schema prisma
```

---

## 전역 규칙

| Category | Rule |
|----------|------|
| 설계 원칙 | 도메인 규칙을 App 레이어에 작성하지 마라 |
| 설계 원칙 | 암시적 동작보다 명시적 설계를 우선 |
| 확장성 | 확장성을 해치지 않는 방향 선택 |
| 유지보수 | 단기 편의보다 장기 유지보수 우선 |
| 문서화 | 기능 구현 시 관련 문서 동기화 필수 |

---

## 통합 금지사항

| 영역 | 금지 |
|-----|------|
| 구조 | 기존 프로젝트 구조 단순화, 도메인 경계 임의 무너뜨리기 |
| 레이어 | Controller/UI에 비즈니스 로직, Domain에서 ORM/Framework 의존 |
| 코드 | 임시 코드, TODO, 주석으로 로직 대체 |
| 기술 | 명확한 근거 없이 새로운 기술 도입 |
| 데이터 | Hard Delete 전제 설계, 트랜잭션 없이 다중 테이블 변경 |
| 보안 | 인증/인가 우회, 민감정보 로깅, 하드코딩 시크릿 |
| 테스트 | 테스트 생략, Mock으로 핵심 도메인 로직 대체 |
| 문서 | 기능 구현 후 추적 문서 업데이트 생략 |
| 배포 | AI 생성 코드 무검증 운영 배포 |

---

## 추적 워크플로우 (필수)

```text
1. REQUIREMENTS.md에서 REQ-ID 확인/생성
       ↓
2. 구현 시작 → tracking/CHANGELOG.md에 TR-ID 생성 (REQ-ID 참조)
       ↓
3. 구현 완료 → FLOW.md에 관련 흐름 업데이트
       ↓
4. CHANGELOG 상태를 Done으로 변경
```

### 추적 대상

| 작업 유형 | 추적 | 관련 문서 |
|----------|-----|----------|
| 신규 기능 개발 | 필수 | REQ → TR → Flow |
| 버그 수정 | 필수 | TR |
| DB 스키마 변경 | 필수 | TR + DATABASE.md |
| API 계약 변경 | 필수 | TR + tracking/API.md |
| 도메인 로직 변경 | 필수 | TR + FLOW.md |
| 리팩토링 (3개+ 파일) | 필수 | TR |
| 보안 관련 변경 | 필수 | TR + SECURITY.md |

---

## AI 사용 규칙

| 구분 | Rule |
|-----|------|
| 책임 | AI는 보조 도구, 최종 책임은 개발자 |
| 단위 | 리뷰 가능한 작은 변경 단위로 반영 |
| 컨벤션 | AI 생성 코드도 팀 코딩 컨벤션 준수 |
| 범위 | 기능 단위로 제한, 전체 시스템 일괄 구현 금지 |
| 보안 | 운영 비밀키/토큰/PII 입력 금지 |
| 검증 | 단위/통합 테스트 필수, 무검증 배포 금지 |

---

## 커밋 규칙

| Rule |
|------|
| 기능 1개당 커밋 1개 원칙 |
| 하나의 커밋은 하나의 논리적 변경 단위만 포함 |
| 커밋 메시지는 변경 목적이 명확하게 드러나도록 |

### 커밋 메시지 형식

```text
type(scope): 한 줄 요약

type: feat, fix, refactor, perf, test, docs, chore
scope: 변경 대상 (sourcing, shop, db 등)
```

---

## 응답 스타일

1. 결론 요약 (TL;DR)
2. 이유 / 배경 설명
3. 권장 설계 또는 접근 방식
4. 필요 시 코드 또는 구조
5. 주의사항 또는 대안

| 규칙 |
|-----|
| 한국어 응답 |
| 추측 시 "추측"이라고 명시 |
| 구조화된 Markdown 사용 |
| 회피성 답변 금지 |

---

## 문서 업데이트 체크리스트

기능 구현 완료 시:

- [ ] docs/tracking/REQUIREMENTS.md에 REQ-ID 존재 확인
- [ ] docs/tracking/CHANGELOG.md에 TR-ID 기록
- [ ] docs/tracking/FLOW.md 흐름 변경 시 업데이트
- [ ] API 변경 시 docs/API.md 업데이트
- [ ] DB 변경 시 docs/DATABASE.md 스키마 반영
- [ ] 보안 변경 시 docs/SECURITY.md 검토