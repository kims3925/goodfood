# Pull Request Template

> **관련 문서:** [STRUCTURE.md](./STRUCTURE.md) | [tracking/CHANGELOG.md](./tracking/CHANGELOG.md) | [CLAUDE.md](./CLAUDE.md)

---

## PR 제목 및 커밋 메시지 형식 (동일)

```
type(scope): 한글 설명
```

**예시:**
- `fix(migration): 마이그레이션의 FK 제약조건과 Prisma 스키마의 불일치 수정`
- `feat(order): 주문 취소 기능 추가`
- `docs(db): DATABASE.md 스키마 변경사항 문서화`

### Type

| Type | 설명 | 예시 |
|-----|-----|-----|
| feat | 새로운 기능 | 신규 API, 새 컴포넌트 |
| fix | 버그 수정 | FK 불일치, 로직 오류 |
| refactor | 리팩토링 | 코드 구조 개선 |
| perf | 성능 개선 | 쿼리 최적화 |
| test | 테스트 | 테스트 추가/수정 |
| docs | 문서 | README, 스키마 문서 |
| chore | 설정/잡무 | 의존성, 설정 파일 |

### Scope

도메인명 또는 레이어명: `order`, `user`, `api`, `ui`, `schema`, `migration`, `db`

---

## PR 본문 템플릿

```markdown
## Summary
- 변경 사항 2~3줄 요약

## Context
- 관련 이슈: [JIRA-123](link)
- REQ-ID: REQ-XXX-NNN
- TR-ID: TR-YYYYMMDD-NNN

## Changes
- [ ] 변경 1
- [ ] 변경 2

## Impact
- [ ] API Contract 변경
- [ ] DB Schema 변경
- [ ] 환경변수 변경

## Testing
- [ ] Unit Test 통과
- [ ] Integration Test 통과

## Checklist
- [ ] Self-review 완료
- [ ] 테스트 코드 작성
- [ ] tracking/CHANGELOG.md 기록
```