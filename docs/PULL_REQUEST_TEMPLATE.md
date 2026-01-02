# Pull Request Template

> **관련 문서:** [STRUCTURE.md](./STRUCTURE.md) | [tracking/CHANGELOG.md](./tracking/CHANGELOG.md) | [CLAUDE.md](./CLAUDE.md)

---

## PR 제목 형식

```
type(scope): 한 줄 요약
```

### Type

| Type | 설명 |
|-----|-----|
| feat | 새로운 기능 |
| fix | 버그 수정 |
| refactor | 리팩토링 |
| perf | 성능 개선 |
| test | 테스트 |
| docs | 문서 |
| chore | 설정/잡무 |

### Scope

도메인명 또는 레이어명: `order`, `user`, `api`, `ui`, `schema`

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