# HOTFIX: 푸터 이미지로 인한 소매밴드 발행 0% 실패 수정

## 긴급도: 🔴 Critical — 현재 모든 소매밴드 발행이 실패 중

---

## 1. 문제 요약

| 항목 | 내용 |
|------|------|
| **증상** | 소매밴드 발행 0/92, 0/37, 0/230 — **전체 실패 (0%)** |
| **원인 커밋** | `4912ec5` (2026-05-13) — 채널별 푸터 이미지 자동 첨부 |
| **근본 원인** | 푸터 이미지가 상대경로(`/api/images/...`)로 저장 → 발행 시 HTTP로 자기 서버에 다운로드 시도 → 실패 → 이미지 1개라도 실패하면 전체 발행 throw |
| **영향 범위** | 푸터 이미지가 등록된 모든 채널의 모든 발행 |

---

## 2. 버그 흐름 (3개 파일 연쇄)

```
① route.ts: DB에 "/api/images/channel/file/xxx.jpg" (상대경로) 저장
        ↓
② publish.service.ts: imageUrls 배열 끝에 상대경로 그대로 추가
        ↓
③ band-post.automation.ts:
   - "/"로 시작 → NEXT_PUBLIC_APP_URL + 상대경로 → 절대 URL 변환
   - NEXT_PUBLIC_APP_URL 미설정 → "http://localhost:3001/api/..." 로 fetch
   - fetch 실패 → downloadedImages에서 누락
   - failedCount > 0 → throw BandPlaywrightError → 발행 전체 실패
```

---

## 3. 수정 작업 (3개 파일, 총 3곳)

### 수정 1: 푸터 이미지를 로컬 파일 경로로 직접 읽기 (핵심 수정)

**파일:** `sourcing-app/src/modules/band-playwright/band-post.automation.ts`  
**위치:** `downloadSingleImage` 메서드 내부, 약 라인 1215~1230

**현재 코드:**
```typescript
      const looksLocal =
        /^[a-zA-Z]:[\\/]/.test(imageUrl) ||
        (imageUrl.startsWith('/') && !imageUrl.startsWith('//'))
      if (looksLocal && fs.existsSync(imageUrl)) {
        console.log(`[밴드자동화] 로컬 파일 사용(abs): ${imageUrl}`)
        return imageUrl
      }

      // 상대 경로를 절대 URL로 변환
      let fullUrl = imageUrl
      if (imageUrl.startsWith('/')) {
        // 로컬 서버 URL (개발: localhost:3001, 프로덕션: 환경변수)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
        fullUrl = `${baseUrl}${imageUrl}`
        console.log(`[밴드자동화] 상대 URL 변환: ${imageUrl} -> ${fullUrl}`)
      }
```

**수정 코드:**
```typescript
      const looksLocal =
        /^[a-zA-Z]:[\\/]/.test(imageUrl) ||
        (imageUrl.startsWith('/') && !imageUrl.startsWith('//'))
      if (looksLocal && fs.existsSync(imageUrl)) {
        console.log(`[밴드자동화] 로컬 파일 사용(abs): ${imageUrl}`)
        return imageUrl
      }

      // ── 채널 푸터/커버 등 내부 API 이미지 → 로컬 파일 직접 읽기 ──
      // "/api/images/channel/file/xxx.jpg" 또는 "/api/images/product/file/xxx.jpg" 패턴
      const internalFileMatch = imageUrl.match(/^\/api\/images\/(?:channel|product|post)\/file\/(.+)$/)
      if (internalFileMatch) {
        const storageBasePath = process.env.CHANNEL_IMAGE_STORAGE_PATH
        if (storageBasePath) {
          const os = require('os')
          const expandedBase = storageBasePath.startsWith('~')
            ? path.join(os.homedir(), storageBasePath.slice(1))
            : storageBasePath
          const localFilePath = path.join(expandedBase, internalFileMatch[1])
          if (fs.existsSync(localFilePath)) {
            console.log(`[밴드자동화] 내부 이미지 로컬 파일 직접 사용: ${imageUrl} -> ${localFilePath}`)
            return localFilePath
          } else {
            console.warn(`[밴드자동화] 내부 이미지 로컬 파일 없음: ${localFilePath}, HTTP 폴백 시도`)
          }
        }
      }

      // 상대 경로를 절대 URL로 변환
      let fullUrl = imageUrl
      if (imageUrl.startsWith('/')) {
        // 로컬 서버 URL (개발: localhost:3001, 프로덕션: 환경변수)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
        fullUrl = `${baseUrl}${imageUrl}`
        console.log(`[밴드자동화] 상대 URL 변환: ${imageUrl} -> ${fullUrl}`)
      }
```

**설명:**  
`/api/images/channel/file/xxx.jpg` 패턴이면 HTTP 요청 대신 `CHANNEL_IMAGE_STORAGE_PATH` 디렉토리에서 파일을 직접 읽습니다. 파일이 없을 때만 기존 HTTP 폴백으로 진행합니다.

---

### 수정 2: 푸터 이미지 다운로드 실패 시 상품 발행은 계속하기

**파일:** `sourcing-app/src/modules/band-playwright/band-post.automation.ts`  
**위치:** 약 라인 581~589

**현재 코드:**
```typescript
        // 이미지 다운로드 실패 확인 - 하나라도 실패하면 전체 실패
        const failedCount = totalImages - downloadedImages.length
        if (failedCount > 0) {
          console.error(`[밴드자동화] 이미지 다운로드 실패: ${failedCount}/${totalImages}개 실패`)
          throw new BandPlaywrightError(
            `이미지 다운로드 실패: ${failedCount}개 이미지를 다운로드할 수 없습니다.`,
            BandPlaywrightErrorCode.UPLOAD_TIMEOUT
          )
        }
```

**수정 코드:**
```typescript
        // 이미지 다운로드 실패 확인
        const failedCount = totalImages - downloadedImages.length
        if (failedCount > 0) {
          console.warn(`[밴드자동화] 이미지 다운로드 부분 실패: ${failedCount}/${totalImages}개 실패 (성공 ${downloadedImages.length}개로 진행)`)
          // 성공한 이미지가 1개 이상이면 발행 계속, 전부 실패한 경우만 throw
          if (downloadedImages.length === 0) {
            throw new BandPlaywrightError(
              `이미지 다운로드 전체 실패: ${totalImages}개 모두 다운로드할 수 없습니다.`,
              BandPlaywrightErrorCode.UPLOAD_TIMEOUT
            )
          }
        }
```

**설명:**  
기존: 이미지 1개라도 실패 → 전체 발행 중단 (throw)  
수정: 성공한 이미지가 1개 이상이면 그것으로 발행 계속. 전부 실패한 경우만 throw.

---

### 수정 3: 푸터 이미지 저장 시 절대 경로도 함께 저장 (선택사항)

**파일:** `sourcing-app/src/app/api/channel/[id]/footer-image/route.ts`  
**위치:** 약 라인 124~130

**현재 코드:**
```typescript
    // 채널 cover 이미지와 동일한 서빙 경로 사용
    const url = `/api/images/channel/file/${filename}`

    await prisma.channel.update({
      where: { id: channelId },
      data: { footerImageUrl: url },
    })
```

**수정 코드:**
```typescript
    // 채널 cover 이미지와 동일한 서빙 경로 사용
    // 발행 시 로컬 파일 직접 접근을 위해 상대경로 유지 (band-post.automation.ts에서 로컬 파일로 매핑)
    const url = `/api/images/channel/file/${filename}`

    await prisma.channel.update({
      where: { id: channelId },
      data: { footerImageUrl: url },
    })

    console.log(`[footer-image] 저장 완료: DB=${url}, 파일=${filePath}`)
```

**설명:**  
URL 저장 방식은 유지하되, 로그를 추가하여 디버깅 용이하게 합니다.  
실제 매핑은 수정 1에서 처리하므로 여기는 변경 최소화.

---

## 4. 수정 후 검증 방법

### 4-1. 코드 검증
```bash
# 타입체크
npm run typecheck:sourcing

# 빌드 확인
npm run build:sourcing
```

### 4-2. 기능 검증
1. sourcing-app 재시작
2. 자동화 설정에서 **소매밴드 발행** 수동 실행 (소량, 예: 5~10건)
3. 서버 콘솔에서 아래 로그 확인:
   - `[밴드자동화] 내부 이미지 로컬 파일 직접 사용:` ← 수정 1 정상 작동
   - `[밴드자동화] 이미지 다운로드 부분 실패: ... (성공 N개로 진행)` ← 수정 2 정상 작동
4. 발행 성공률이 0%에서 정상 복구되는지 확인

### 4-3. 환경변수 확인 (보조)
EC2 서버의 `.env` 파일에 아래 값이 설정되어 있는지도 확인:
```
CHANNEL_IMAGE_STORAGE_PATH=~/bandauto-images  (또는 실제 저장 경로)
NEXT_PUBLIC_APP_URL=http://localhost:3001      (또는 실제 서버 주소)
```

---

## 5. 즉시 임시 조치 (코드 수정 전 급한 경우)

코드 수정 전에 DB에서 푸터 이미지를 임시 제거하면 즉시 발행이 복구됩니다:

```sql
-- 현재 등록된 푸터 이미지 확인
SELECT id, name, footer_image_url FROM channel WHERE footer_image_url IS NOT NULL;

-- 임시 제거 (발행 즉시 복구)
UPDATE channel SET footer_image_url = NULL WHERE footer_image_url IS NOT NULL;
```

코드 수정 완료 후 다시 푸터 이미지를 업로드하면 됩니다.

---

## 6. 커밋 메시지

```
fix(publish): 푸터 이미지 상대경로로 인한 발행 전체 실패 수정

- 내부 API 이미지 경로를 로컬 파일시스템에서 직접 읽도록 변경
- 이미지 부분 실패 시 성공분으로 발행 계속 (전체 실패만 throw)
- 5/15 소매밴드 발행 0% 실패 원인 해결
```
