/**
 * Band 글 작성 + 이미지 업로드 자동화
 */

import { Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  BandPublishParams,
  BandPublishResult,
  BandBatchPublishParams,
  BandBatchItemResult,
  BandBatchPublishResult,
  BandPlaywrightError,
  BandPlaywrightErrorCode,
} from './types'
import type { PublishStage } from '../publish/types'

// 단계별 라벨 (한국어)
const STAGE_LABELS: Record<PublishStage, string> = {
  preparing: '준비 중',
  downloading: '이미지 다운로드 중',
  uploading: '이미지 업로드 중',
  entering: '내용 입력 중',
  submitting: '게시물 등록 중',
  retrying: '재시도 중',
  completed: '완료',
  failed: '실패',
  skipped: '건너뜀',
}

// Band 최대 이미지 수
const MAX_IMAGES = 20
// 이미지 업로드 타임아웃
const IMAGE_UPLOAD_TIMEOUT_MS = 60000
// 게시 타임아웃
const POST_TIMEOUT_MS = 30000
// 디버그 스크린샷 저장 경로 (Windows/Linux 호환)
const DEBUG_SCREENSHOT_DIR = process.platform === 'win32'
  ? path.join(os.tmpdir(), 'band-playwright-debug')
  : '/tmp/band-playwright-debug'

// 스크린샷 보관 시간 (3시간)
const SCREENSHOT_TTL_MS = 3 * 60 * 60 * 1000

export class BandPostAutomation {
  private lastCleanupTime = 0

  /**
   * 오래된 스크린샷 파일 정리 (3시간 이상 된 파일 삭제)
   */
  private cleanupOldScreenshots(): void {
    // 10분마다 한 번만 실행
    const now = Date.now()
    if (now - this.lastCleanupTime < 10 * 60 * 1000) {
      return
    }
    this.lastCleanupTime = now

    try {
      if (!fs.existsSync(DEBUG_SCREENSHOT_DIR)) {
        return
      }

      const files = fs.readdirSync(DEBUG_SCREENSHOT_DIR)
      let deletedCount = 0

      for (const file of files) {
        if (!file.endsWith('.png')) continue

        const filepath = path.join(DEBUG_SCREENSHOT_DIR, file)
        const stat = fs.statSync(filepath)
        const age = now - stat.mtimeMs

        if (age > SCREENSHOT_TTL_MS) {
          fs.unlinkSync(filepath)
          deletedCount++
        }
      }

      if (deletedCount > 0) {
        console.log(`[밴드자동화] 오래된 스크린샷 ${deletedCount}개 삭제됨`)
      }
    } catch (error) {
      console.error('[밴드자동화] 스크린샷 정리 실패:', error)
    }
  }

  /**
   * 디버그 스크린샷 저장
   */
  private async saveDebugScreenshot(page: Page, name: string): Promise<void> {
    try {
      // 오래된 스크린샷 정리
      this.cleanupOldScreenshots()

      if (!fs.existsSync(DEBUG_SCREENSHOT_DIR)) {
        fs.mkdirSync(DEBUG_SCREENSHOT_DIR, { recursive: true })
      }
      const filepath = path.join(DEBUG_SCREENSHOT_DIR, `${name}-${Date.now()}.png`)
      await page.screenshot({ path: filepath, fullPage: true })
      console.log(`[밴드자동화] 스크린샷 저장: ${filepath}`)
    } catch (error) {
      console.error('[밴드자동화] 스크린샷 저장 실패:', error)
    }
  }

  /**
   * Band 홈에서 채널명으로 밴드를 찾아 해당 페이지로 이동
   * Band API의 bandKey는 항상 AAC... 형식이므로 채널명으로 찾아야 함
   */
  private async navigateToBand(page: Page, bandKey: string, bandName: string): Promise<void> {
    console.log(`[밴드자동화] 밴드 이동: "${bandName}"`)

    // Band 홈에서 채널명으로 밴드 찾기
    console.log(`[밴드자동화] Band 홈에서 밴드 검색 중...`)
    await page.goto('https://band.us/home', {
      waitUntil: 'load',  // 페이지 완전 로드 대기
      timeout: POST_TIMEOUT_MS,
    })

    // 로딩 스피너가 사라질 때까지 대기 (최대 10초)
    try {
      await page.waitForSelector('text=로딩 중입니다', { state: 'hidden', timeout: 10000 })
      console.log('[밴드자동화] 로딩 완료')
    } catch {
      console.log('[밴드자동화] 로딩 스피너 대기 타임아웃 (계속 진행)')
    }

    // 로그인 체크
    const currentUrl = page.url()
    if (currentUrl.includes('signin') || currentUrl.includes('login')) {
      throw new BandPlaywrightError(
        '로그인이 필요합니다. 세션이 만료되었을 수 있습니다.',
        BandPlaywrightErrorCode.SESSION_EXPIRED
      )
    }

    // 밴드 목록이 로드될 때까지 대기 (최대 10초)
    try {
      await page.waitForSelector('.bandCardItem a.bandCover, a.bandCover._link', { timeout: 10000 })
      console.log('[밴드자동화] 밴드 목록 로드됨')
    } catch {
      console.log('[밴드자동화] 밴드 목록 로드 대기 타임아웃')
    }

    await this.saveDebugScreenshot(page, 'band-home')

    // 밴드 커버 링크에서 채널명과 일치하는 밴드 찾기
    // Band 웹사이트 구조: li.bandCardItem > div > div > a.bandCover._link
    const bandLinkSelector = `.bandCardItem a.bandCover, a.bandCover._link, .bandList a[href*="/band/"], .myBandList a[href*="/band/"], .bandItem a[href*="/band/"]`

    // 밴드 링크 수집 함수
    const collectBandLinks = async () => {
      return await page.$$eval(bandLinkSelector, (links) =>
        links.map((link) => ({
          href: link.getAttribute('href') || '',
          text: link.textContent?.trim() || '',
          imgAlt: link.querySelector('img')?.getAttribute('alt') || '',
          // .bandName .uriText 에서 밴드 이름만 추출 (Band 웹사이트 구조)
          bandNameText: (
            link.querySelector('.bandName .uriText')?.textContent?.trim() ||
            link.querySelector('.bandName p.uriText')?.textContent?.trim() ||
            ''
          ),
        }))
      )
    }

    // 첫 번째 시도: 밴드 링크 찾기
    let rawBandLinks = await collectBandLinks()

    // 밴드 목록이 없으면 "내 밴드" 탭 클릭 후 재시도
    if (rawBandLinks.length === 0) {
      console.log('[밴드자동화] 밴드 목록 없음, "내 밴드" 탭 클릭 시도...')
      try {
        const myBandTab = await page.$('a:has-text("내 밴드"), button:has-text("내 밴드"), [class*="myBand"] a')
        if (myBandTab) {
          await myBandTab.click()
          await page.waitForTimeout(1500)
          rawBandLinks = await collectBandLinks()
        }
      } catch { /* 무시 */ }
    }

    // 여전히 없으면 페이지 새로고침 후 재시도
    if (rawBandLinks.length === 0) {
      console.log('[밴드자동화] 밴드 목록 여전히 없음, 페이지 새로고침...')
      await page.reload({ waitUntil: 'load' })

      // 로딩 스피너가 사라질 때까지 대기
      try {
        await page.waitForSelector('text=로딩 중입니다', { state: 'hidden', timeout: 15000 })
        console.log('[밴드자동화] 새로고침 후 로딩 완료')
      } catch {
        console.log('[밴드자동화] 새로고침 후 로딩 대기 타임아웃')
      }

      // 밴드 목록 로드 대기
      try {
        await page.waitForSelector('.bandCardItem a.bandCover, a.bandCover._link', { timeout: 10000 })
        console.log('[밴드자동화] 새로고침 후 밴드 목록 로드됨')
      } catch {
        console.log('[밴드자동화] 새로고침 후 밴드 목록 로드 실패')
      }

      await this.saveDebugScreenshot(page, 'band-home-refreshed')
      rawBandLinks = await collectBandLinks()
    }

    // UI 버튼 텍스트 및 유효하지 않은 링크 필터링
    const uiButtonTexts = ['이 밴드로 이동', '밴드 가이드 보기', '밴드 만들기', '더보기', '설정']
    const bandLinks = rawBandLinks.filter((link) => {
      // href가 /band/숫자 형태인지 확인
      const bandIdMatch = link.href.match(/\/band\/(\d+)/)
      if (!bandIdMatch) return false

      // UI 버튼 텍스트 제외
      const linkText = link.text || link.bandNameText || link.imgAlt
      if (uiButtonTexts.some((btn) => linkText === btn || linkText.includes(btn))) return false

      // 텍스트가 너무 짧거나 없는 경우 (UI 요소일 가능성)
      const effectiveText = link.bandNameText || link.imgAlt || link.text
      if (!effectiveText || effectiveText.length < 2) return false

      return true
    })

    console.log(`[밴드자동화] ${bandLinks.length}개 밴드 링크 발견 (필터링 후, 원본: ${rawBandLinks.length}개)`)

    // 채널명과 일치하는 링크 찾기 (정확히 일치하거나 포함)
    const matchedLink = bandLinks.find(
      (link) =>
        link.text === bandName ||
        link.text.includes(bandName) ||
        link.imgAlt === bandName ||
        link.imgAlt.includes(bandName) ||
        link.bandNameText === bandName ||
        link.bandNameText.includes(bandName)
    )

    if (matchedLink) {
      console.log(`[밴드자동화] 일치하는 밴드 발견: "${matchedLink.text || matchedLink.bandNameText || matchedLink.imgAlt}" -> ${matchedLink.href}`)

      // 해당 링크 클릭
      const linkElement = await page.$(`a[href="${matchedLink.href}"]`)
      if (linkElement) {
        await linkElement.click()
        await page.waitForLoadState('domcontentloaded')  // networkidle → domcontentloaded (최적화)
        console.log(`[밴드자동화] 밴드 페이지 이동 완료: ${page.url()}`)
        return
      }
    }

    // 정확히 일치하는 게 없으면 부분 일치로 재시도
    console.log(`[밴드자동화] 정확히 일치하는 밴드 없음, 부분 일치 시도...`)
    for (const link of bandLinks) {
      const linkText = link.text || link.imgAlt
      // 공백/특수문자 제거 후 비교
      const normalizedBandName = bandName.replace(/\s+/g, '').toLowerCase()
      const normalizedLinkText = linkText.replace(/\s+/g, '').toLowerCase()

      if (normalizedLinkText.includes(normalizedBandName) || normalizedBandName.includes(normalizedLinkText)) {
        console.log(`[밴드자동화] 부분 일치 발견: "${linkText}" -> ${link.href}`)

        const linkElement = await page.$(`a[href="${link.href}"]`)
        if (linkElement) {
          await linkElement.click()
          await page.waitForLoadState('domcontentloaded')  // networkidle → domcontentloaded (최적화)
          console.log(`[밴드자동화] 밴드 페이지 이동 완료: ${page.url()}`)
          return
        }
      }
    }

    // 찾지 못한 경우 에러
    console.log(`[밴드자동화] 사용 가능한 밴드:`, bandLinks.map(l => l.bandNameText || l.imgAlt || l.text).join(', '))
    throw new BandPlaywrightError(
      `밴드를 찾을 수 없습니다. bandName: ${bandName}`,
      BandPlaywrightErrorCode.POST_FAILED
    )
  }

  /**
   * 이미지 포함 게시물 작성
   */
  async createPostWithImages(
    page: Page,
    params: BandPublishParams
  ): Promise<BandPublishResult> {
    const { bandKey, bandName, content, imageUrls, onStageProgress } = params
    const tempFiles: string[] = []

    // 단계 진행 알림 헬퍼
    const reportStage = async (
      stage: PublishStage,
      imageProgress?: { current: number; total: number }
    ) => {
      if (onStageProgress) {
        await onStageProgress({
          stage,
          stageLabel: STAGE_LABELS[stage],
          imageProgress,
          publishMethod: 'playwright',
        })
      }
    }

    try {
      console.log(`[밴드자동화] 게시물 작성 시작: ${bandName} (key: ${bandKey})`)
      console.log(`[밴드자동화] 내용 길이: ${content.length}, 이미지: ${imageUrls.length}개`)

      // 0. 준비 단계
      await reportStage('preparing')

      // 1. 밴드 페이지로 이동 (1회 재시도)
      try {
        await this.navigateToBand(page, bandKey, bandName)
      } catch (navError: any) {
        console.warn(`[밴드자동화] 밴드 찾기 실패, 1회 재시도: ${navError.message}`)
        await page.waitForTimeout(2000)
        await this.navigateToBand(page, bandKey, bandName)
      }

      // 현재 URL 확인 (로그인 리다이렉트 체크)
      const currentUrl = page.url()
      console.log(`[밴드자동화] 현재 URL: ${currentUrl}`)

      // 발행 전 최신 게시물 postKey 저장 (나중에 비교용)
      const bandNoMatch = currentUrl.match(/\/band\/(\d+)/)
      const currentBandNo = bandNoMatch ? bandNoMatch[1] : ''
      const beforePostKey = await this.getLatestPostKey(page, currentBandNo)
      console.log(`[밴드자동화] 발행 전 최신 postKey: ${beforePostKey || '없음'}`)

      if (currentUrl.includes('signin') || currentUrl.includes('login')) {
        await this.saveDebugScreenshot(page, 'login-redirect')
        throw new BandPlaywrightError(
          '로그인이 필요합니다. 세션이 만료되었을 수 있습니다.',
          BandPlaywrightErrorCode.SESSION_EXPIRED
        )
      }

      await this.saveDebugScreenshot(page, 'step1-page-loaded')

      // 2. 글쓰기 레이어 열기
      console.log('[밴드자동화] 2단계: 글쓰기 레이어 열기')

      // 글쓰기 버튼 클릭 시도 (최대 2회)
      for (let attempt = 0; attempt < 2; attempt++) {
        // 글쓰기 버튼 셀렉터들 (우선순위 순)
        const writeButtonSelectors = [
          'button._btnOpenWriteLayer',           // 실제 Band UI 글쓰기 버튼
          'button.cPostWriteEventWrapper',       // 글쓰기 래퍼 버튼
          'button._btnPostWrite',                // 레거시 셀렉터
          '[data-viewname="DPostFakeEditorView"]', // 가짜 에디터 영역
        ]

        let clicked = false
        for (const selector of writeButtonSelectors) {
          const writeButton = await page.$(selector)
          if (writeButton && await writeButton.isVisible()) {
            console.log(`[밴드자동화] 글쓰기 버튼 발견: ${selector} (시도 ${attempt + 1})`)
            await writeButton.click()
            clicked = true
            break
          }
        }

        if (!clicked) {
          console.warn('[밴드자동화] 글쓰기 버튼을 찾을 수 없음')
        }

        // 에디터(contenteditable)가 나타날 때까지 대기 (최대 5초)
        try {
          await page.waitForSelector('[data-viewname="DPostWriteLayerView"] [contenteditable="true"], .cPostWrite [contenteditable="true"].cke_editable', {
            timeout: 5000,
            state: 'visible'
          })
          console.log('[밴드자동화] 에디터 로드됨')
          break  // 성공하면 루프 종료
        } catch {
          console.warn(`[밴드자동화] 에디터 대기 타임아웃 (시도 ${attempt + 1})`)
          // 실패 시 페이지 새로고침 후 재시도
          console.log('[밴드자동화] 페이지 새로고침 후 재시도...')
          await page.reload({ waitUntil: 'load' })
          await page.waitForTimeout(2000)
        }
      }

      await this.saveDebugScreenshot(page, 'step2-write-layer-opened')

      // 글쓰기 레이어가 열렸는지 최종 확인 (에디터 기준)
      const editorExists = await page.$('[data-viewname="DPostWriteLayerView"] [contenteditable="true"], .cPostWrite [contenteditable="true"].cke_editable')
      if (!editorExists || !(await editorExists.isVisible())) {
        console.error('[밴드자동화] 글쓰기 레이어 열기 실패!')
        throw new BandPlaywrightError(
          '글쓰기 레이어를 열 수 없습니다.',
          BandPlaywrightErrorCode.POST_FAILED
        )
      }
      console.log('[밴드자동화] 글쓰기 레이어 열림 확인')

      // 3. 본문 입력 (먼저 입력해야 게시물 상단에 표시됨)
      await reportStage('entering')
      console.log('[밴드자동화] 3단계: 본문 입력')
      await this.inputContent(page, content)
      await this.saveDebugScreenshot(page, 'step3-content-entered')

      // 4. 이미지 다운로드 및 업로드 (본문 아래에 표시됨)
      const imagesToUpload = imageUrls.slice(0, MAX_IMAGES)
      const totalImages = imagesToUpload.length
      if (totalImages > 0) {
        // 다운로드 단계
        await reportStage('downloading', { current: 0, total: totalImages })
        console.log(`[밴드자동화] 4단계: ${totalImages}개 이미지 다운로드`)

        const downloadedImages = await this.downloadImagesWithProgress(
          imagesToUpload,
          async (current, total) => {
            await reportStage('downloading', { current, total })
          }
        )
        tempFiles.push(...downloadedImages)
        console.log(`[밴드자동화] ${downloadedImages.length}/${totalImages}개 이미지 다운로드 완료`)

        // 이미지 다운로드 실패 확인 - 하나라도 실패하면 전체 실패
        const failedCount = totalImages - downloadedImages.length
        if (failedCount > 0) {
          console.error(`[밴드자동화] 이미지 다운로드 실패: ${failedCount}/${totalImages}개 실패`)
          throw new BandPlaywrightError(
            `이미지 다운로드 실패: ${failedCount}개 이미지를 다운로드할 수 없습니다.`,
            BandPlaywrightErrorCode.UPLOAD_TIMEOUT
          )
        }

        if (downloadedImages.length > 0) {
          // 업로드 단계
          await reportStage('uploading', { current: 0, total: downloadedImages.length })
          console.log('[밴드자동화] 5단계: 이미지 업로드')

          await this.uploadImagesWithProgress(
            page,
            downloadedImages,
            async (current, total) => {
              await reportStage('uploading', { current, total })
            }
          )
          await this.saveDebugScreenshot(page, 'step5-images-uploaded')
        }
      }

      // 5. 게시 버튼 클릭
      await reportStage('submitting')
      console.log('[밴드자동화] 6단계: 게시물 등록')
      await this.submitPost(page)
      await this.saveDebugScreenshot(page, 'step6-post-submitted')

      // 6. 게시 완료 대기 및 postKey 추출
      await page.waitForTimeout(3000)
      // 새 게시물 postKey 추출 (이전 postKey와 비교하여 실제 발행 확인)
      const postKey = await this.extractNewPostKey(page, currentBandNo, beforePostKey)

      console.log(`[밴드자동화] 게시물 작성 성공: ${postKey}`)

      // 완료 단계
      await reportStage('completed', { current: tempFiles.length, total: tempFiles.length })

      return {
        success: true,
        postKey,
        imageCount: tempFiles.length,
      }
    } catch (error: any) {
      console.error('[밴드자동화] 게시물 작성 실패:', error)
      await this.saveDebugScreenshot(page, 'error')

      // 실패 단계
      if (onStageProgress) {
        await onStageProgress({
          stage: 'failed',
          stageLabel: STAGE_LABELS.failed,
          error: error.message,
          publishMethod: 'playwright',
        })
      }

      if (error instanceof BandPlaywrightError) {
        return { success: false, error: error.message }
      }

      return {
        success: false,
        error: error.message || '게시물 작성 중 오류가 발생했습니다.',
      }
    } finally {
      // 임시 파일 정리
      this.cleanupTempFiles(tempFiles)
    }
  }

  /**
   * 이미지 다운로드
   */
  private async downloadImages(imageUrls: string[]): Promise<string[]> {
    const tempDir = os.tmpdir()
    const downloaded: string[] = []
    const BATCH_SIZE = 5

    // 병렬 다운로드 (5개씩)
    for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
      const batch = imageUrls.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((url, idx) => this.downloadSingleImage(url, tempDir, i + idx))
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          downloaded.push(result.value)
        }
      }
    }

    return downloaded
  }

  /**
   * 이미지 다운로드 (진행률 콜백 포함)
   */
  private async downloadImagesWithProgress(
    imageUrls: string[],
    onProgress?: (current: number, total: number) => void | Promise<void>
  ): Promise<string[]> {
    const tempDir = os.tmpdir()
    const downloaded: string[] = []
    const total = imageUrls.length

    // 순차 다운로드 (진행률 추적을 위해)
    for (let i = 0; i < imageUrls.length; i++) {
      const result = await this.downloadSingleImage(imageUrls[i], tempDir, i)
      if (result) {
        downloaded.push(result)
      }
      // 진행률 콜백
      if (onProgress) {
        await onProgress(i + 1, total)
      }
    }

    return downloaded
  }

  /**
   * 단일 이미지 다운로드
   */
  private async downloadSingleImage(
    imageUrl: string,
    tempDir: string,
    index: number
  ): Promise<string | null> {
    try {
      // 상대 경로를 절대 URL로 변환
      let fullUrl = imageUrl
      if (imageUrl.startsWith('/')) {
        // 로컬 서버 URL (개발: localhost:3001, 프로덕션: 환경변수)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
        fullUrl = `${baseUrl}${imageUrl}`
        console.log(`[밴드자동화] 상대 URL 변환: ${imageUrl} -> ${fullUrl}`)
      }

      const response = await fetch(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      })

      if (!response.ok) {
        console.error(`[밴드자동화] 이미지 다운로드 실패: ${imageUrl} (HTTP ${response.status}: ${response.statusText})`)
        return null
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const ext = this.getExtension(imageUrl, response.headers.get('content-type'))
      const tempPath = path.join(tempDir, `band_upload_${Date.now()}_${index}.${ext}`)

      fs.writeFileSync(tempPath, buffer)
      return tempPath
    } catch (error) {
      console.error(`[밴드자동화] 이미지 다운로드 오류: ${imageUrl}`, error)
      return null
    }
  }

  /**
   * 이미지 업로드 (검증 포함)
   * @returns 업로드된 이미지 수
   */
  private async uploadImagesWithVerification(page: Page, imagePaths: string[]): Promise<number> {
    await this.uploadImages(page, imagePaths)

    // 업로드된 이미지 확인
    const uploadedCount = await this.countUploadedImages(page)
    console.log(`[밴드자동화] 업로드된 이미지 확인: ${uploadedCount}개`)

    return uploadedCount
  }

  /**
   * 업로드된 이미지 수 확인
   */
  private async countUploadedImages(page: Page): Promise<number> {
    // 다양한 셀렉터로 업로드된 이미지 확인
    const uploadedSelectors = [
      '.thumbArea .thumbItem',          // 썸네일 영역
      '.photoListArea .photoItem',      // 사진 목록
      '.cPostWrite .photoArea img',     // 글쓰기 영역 내 이미지
      '[class*="uploadedPhoto"]',       // 업로드된 사진 클래스
      '[class*="photoThumb"]',          // 사진 썸네일
      '.attachedPhotoWrap img',         // 첨부된 사진
      '.cPostWrite img[src*="blob"]',   // blob URL 이미지
      '.cPostWrite img[src*="phinf"]',  // Band CDN 이미지
    ]

    for (const selector of uploadedSelectors) {
      try {
        const items = await page.$$(selector)
        const visibleItems = []
        for (const item of items) {
          if (await item.isVisible()) {
            visibleItems.push(item)
          }
        }
        if (visibleItems.length > 0) {
          console.log(`[밴드자동화] ${visibleItems.length}개 업로드된 이미지 발견: ${selector}`)
          return visibleItems.length
        }
      } catch {
        // 무시
      }
    }

    return 0
  }

  /**
   * 이미지 업로드
   * 레이어 팝업과 인라인 에디터 모두 지원
   */
  private async uploadImages(page: Page, imagePaths: string[]): Promise<void> {
    console.log(`[밴드자동화] ${imagePaths.length}개 이미지 업로드 시작`)

    // 글쓰기 레이어 컨테이너 확인 (레이어 팝업 우선)
    const writeLayerContainers = [
      '[data-viewname="DPostWriteLayerView"]',  // 레이어 팝업 (우선순위 높음)
      '.layerContainer .cPostWrite',
      '.layerContainerView .cPostWrite',
      '.cPostWrite:not(.-standby)',
      '.postWriteLayer',
    ]

    let writeLayerContainer = null
    for (const selector of writeLayerContainers) {
      writeLayerContainer = await page.$(selector)
      if (writeLayerContainer && await writeLayerContainer.isVisible()) {
        console.log(`[밴드자동화] 글쓰기 레이어 발견: ${selector}`)
        break
      }
      writeLayerContainer = null
    }

    // 실제 Band UI의 사진 버튼 셀렉터 (우선순위 순)
    const imageButtonSelectors = [
      // 글쓰기 모달 내 사진 버튼 (label 태그)
      'label.photo._btnAttachPhoto',
      'label._btnAttachPhoto',
      // 레이어 팝업 내 사진 버튼
      '[data-viewname="DPostWriteLayerView"] label.photo',
      '[data-viewname="DPostWriteLayerView"] button.photo',
      '[data-viewname="DPostWriteLayerView"] button[data-attachment="photo"]',
      '.layerContainer label.photo',
      '.layerContainer button.photo',
      // 글쓰기 레이어 내 사진 버튼 (실제 Band DOM 기반)
      'button.photo[data-attachment="photo"]',
      'button[data-attachment="photo"]',
      '.toolbarList button.photo',
      '.postToolbar button.photo',
      // 다른 가능한 셀렉터
      '.cPostWrite button.photo',
      '.writeToolbar .photo',
      // 폴백 셀렉터
      'button[aria-label*="사진"]',
      '.btnPhoto',
      '[data-uiselector="postWriteAddPhoto"]',
    ]

    let imageButton = null
    for (const selector of imageButtonSelectors) {
      // 글쓰기 레이어 내에서 먼저 찾기
      if (writeLayerContainer) {
        imageButton = await writeLayerContainer.$(selector)
        if (imageButton && await imageButton.isVisible()) {
          console.log(`[밴드자동화] 글쓰기 레이어에서 사진 버튼 발견: ${selector}`)
          break
        }
      }
      // 전체 페이지에서 찾기
      imageButton = await page.$(selector)
      if (imageButton && await imageButton.isVisible()) {
        console.log(`[밴드자동화] 사진 버튼 발견: ${selector}`)
        break
      }
      imageButton = null
    }

    // file input 직접 찾기 (버튼이 없을 경우)
    if (!imageButton) {
      console.warn('[밴드자동화] 사진 버튼을 찾을 수 없음, file input 직접 시도')
      const fileInput = await page.$('input[type="file"][accept*="image"]')
      if (fileInput) {
        console.log('[밴드자동화] file input 발견, 파일 직접 설정')
        await fileInput.setInputFiles(imagePaths)

        // Band UI가 파일 변경을 감지하도록 change 이벤트 트리거
        await fileInput.evaluate((el) => {
          el.dispatchEvent(new Event('change', { bubbles: true }))
          el.dispatchEvent(new Event('input', { bubbles: true }))
        })
        console.log('[밴드자동화] change/input 이벤트 발생')

        // 팝업 내에서 이미지 업로드 완료 대기 후 "첨부하기" 클릭
        await this.waitForPopupUploadAndAttach(page, imagePaths.length)

        // 게시글 영역에 이미지가 추가될 때까지 대기
        await this.waitForUploadComplete(page, imagePaths.length)
        return
      }
      throw new BandPlaywrightError(
        '이미지 업로드 버튼을 찾을 수 없습니다.',
        BandPlaywrightErrorCode.UPLOAD_TIMEOUT
      )
    }

    // 파일 선택 대화상자 처리
    console.log('[밴드자동화] 사진 버튼 클릭, 파일 선택창 대기...')

    try {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        imageButton.click(),
      ])

      console.log(`[밴드자동화] 파일 선택창 열림, ${imagePaths.length}개 파일 설정`)
      await fileChooser.setFiles(imagePaths)
    } catch (error: any) {
      // fileChooser 이벤트가 발생하지 않으면 hidden input 직접 찾기
      console.warn('[밴드자동화] 파일 선택창 이벤트 실패:', error.message)
      console.log('[밴드자동화] hidden file input 시도...')

      // 여러 가능한 file input 셀렉터 시도
      const fileInputSelectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"]',
        '.cPostWrite input[type="file"]',
      ]

      let fileInput = null
      for (const selector of fileInputSelectors) {
        fileInput = await page.$(selector)
        if (fileInput) {
          console.log(`[밴드자동화] file input 발견: ${selector}`)
          break
        }
      }

      if (fileInput) {
        // hidden input에 파일 설정
        await fileInput.setInputFiles(imagePaths)

        // Band UI가 파일 변경을 감지하도록 change 이벤트 트리거
        await fileInput.evaluate((el) => {
          el.dispatchEvent(new Event('change', { bubbles: true }))
          el.dispatchEvent(new Event('input', { bubbles: true }))
        })
        console.log('[밴드자동화] change/input 이벤트 발생')
      } else {
        throw new BandPlaywrightError(
          '파일 선택창을 열 수 없습니다.',
          BandPlaywrightErrorCode.UPLOAD_TIMEOUT
        )
      }
    }

    // 팝업 내에서 이미지 업로드 완료 대기 후 "첨부하기" 클릭
    await this.waitForPopupUploadAndAttach(page, imagePaths.length)

    // 게시글 영역에 이미지가 추가될 때까지 대기
    await this.waitForUploadComplete(page, imagePaths.length)
  }

  /**
   * 이미지 업로드 (진행률 콜백 포함)
   */
  private async uploadImagesWithProgress(
    page: Page,
    imagePaths: string[],
    onProgress?: (current: number, total: number) => void | Promise<void>
  ): Promise<void> {
    // 기존 uploadImages와 동일한 로직, 단 waitForUploadComplete에 콜백 전달
    console.log(`[밴드자동화] ${imagePaths.length}개 이미지 업로드 시작 (진행률 추적)`)

    // 글쓰기 레이어 컨테이너 확인 (레이어 팝업 우선)
    const writeLayerContainers = [
      '[data-viewname="DPostWriteLayerView"]',
      '.layerContainer .cPostWrite',
      '.layerContainerView .cPostWrite',
      '.cPostWrite:not(.-standby)',
      '.postWriteLayer',
    ]

    let writeLayerContainer = null
    for (const selector of writeLayerContainers) {
      writeLayerContainer = await page.$(selector)
      if (writeLayerContainer && await writeLayerContainer.isVisible()) {
        console.log(`[밴드자동화] 글쓰기 레이어 발견: ${selector}`)
        break
      }
      writeLayerContainer = null
    }

    // 사진 버튼 찾기
    const imageButtonSelectors = [
      // 글쓰기 모달 내 사진 버튼 (label 태그)
      'label.photo._btnAttachPhoto',
      'label._btnAttachPhoto',
      '[data-viewname="DPostWriteLayerView"] label.photo',
      '[data-viewname="DPostWriteLayerView"] button.photo',
      '[data-viewname="DPostWriteLayerView"] button[data-attachment="photo"]',
      '.layerContainer label.photo',
      '.layerContainer button.photo',
      'button.photo[data-attachment="photo"]',
      'button[data-attachment="photo"]',
      '.toolbarList button.photo',
      '.postToolbar button.photo',
      '.cPostWrite button.photo',
      '.writeToolbar .photo',
      'button[aria-label*="사진"]',
      '.btnPhoto',
      '[data-uiselector="postWriteAddPhoto"]',
    ]

    let imageButton = null
    for (const selector of imageButtonSelectors) {
      if (writeLayerContainer) {
        imageButton = await writeLayerContainer.$(selector)
        if (imageButton && await imageButton.isVisible()) {
          console.log(`[밴드자동화] 글쓰기 레이어에서 사진 버튼 발견: ${selector}`)
          break
        }
      }
      imageButton = await page.$(selector)
      if (imageButton && await imageButton.isVisible()) {
        console.log(`[밴드자동화] 사진 버튼 발견: ${selector}`)
        break
      }
      imageButton = null
    }

    // file input 직접 찾기 (버튼이 없을 경우)
    if (!imageButton) {
      console.warn('[밴드자동화] 사진 버튼을 찾을 수 없음, JavaScript로 버튼 검색 시도')

      // JavaScript로 "사진" 관련 버튼/라벨 찾기
      const photoButtonFound = await page.evaluate(() => {
        // 모든 버튼과 라벨에서 "사진" 텍스트 또는 photo 클래스 찾기
        const elements = document.querySelectorAll('button, label, a')
        for (const el of elements) {
          const text = el.textContent?.trim() || ''
          const className = el.className || ''
          const ariaLabel = el.getAttribute('aria-label') || ''

          if (className.includes('photo') ||
              className.includes('Photo') ||
              text.includes('사진') ||
              ariaLabel.includes('사진') ||
              ariaLabel.includes('photo')) {
            // 클릭 가능하고 보이는지 확인
            const rect = el.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
              console.log('[JS] 사진 버튼 발견:', className, text)
              ;(el as HTMLElement).click()
              return true
            }
          }
        }
        return false
      })

      if (photoButtonFound) {
        console.log('[밴드자동화] JavaScript로 사진 버튼 클릭 성공')
        await page.waitForTimeout(1000) // 팝업 열릴 시간 대기
      } else {
        console.warn('[밴드자동화] JavaScript로도 사진 버튼 못 찾음, file input 직접 시도')
      }

      const fileInput = await page.$('input[type="file"][accept*="image"]')
      if (fileInput) {
        console.log('[밴드자동화] file input 발견, 파일 직접 설정')
        await fileInput.setInputFiles(imagePaths)
        await fileInput.evaluate((el) => {
          el.dispatchEvent(new Event('change', { bubbles: true }))
          el.dispatchEvent(new Event('input', { bubbles: true }))
        })

        // 팝업 내에서 이미지 업로드 완료 대기 후 "첨부하기" 클릭
        await this.waitForPopupUploadAndAttach(page, imagePaths.length)

        // 게시글 영역에 이미지가 추가될 때까지 대기
        await this.waitForUploadCompleteWithProgress(page, imagePaths.length, onProgress)
        return
      }
      throw new BandPlaywrightError(
        '이미지 업로드 버튼을 찾을 수 없습니다.',
        BandPlaywrightErrorCode.UPLOAD_TIMEOUT
      )
    }

    // 파일 선택 대화상자 처리
    // 1. 먼저 사진 버튼 클릭 (커서 위치 확보)
    console.log('[밴드자동화] 사진 버튼 클릭...')
    await imageButton.click()
    await page.waitForTimeout(500)

    // 2. hidden file input에 파일 설정
    console.log('[밴드자동화] hidden file input 찾는 중...')
    const fileInput = await page.$('input[type="file"][accept*="image"]') ||
                      await page.$('input[type="file"]')

    if (fileInput) {
      console.log('[밴드자동화] hidden file input 발견, 파일 설정 중...')
      await fileInput.setInputFiles(imagePaths)
      console.log('[밴드자동화] 파일 설정 완료')
    } else {
      console.error('[밴드자동화] hidden file input을 찾을 수 없음')
      throw new BandPlaywrightError(
        '파일 입력 요소를 찾을 수 없습니다.',
        BandPlaywrightErrorCode.UPLOAD_TIMEOUT
      )
    }

    // 팝업 내에서 이미지 업로드 완료 대기 후 "첨부하기" 클릭
    console.log('[밴드자동화] 팝업 업로드 대기 시작...')
    await this.waitForPopupUploadAndAttach(page, imagePaths.length)

    // 게시글 영역에 이미지가 추가될 때까지 대기
    await this.waitForUploadCompleteWithProgress(page, imagePaths.length, onProgress)
  }

  /**
   * 이미지 업로드 완료 대기 (개선됨)
   * 실제 업로드 상태를 확인하고 게시 버튼 활성화를 대기
   * 상태 변화가 없으면 조기 타임아웃
   */
  private async waitForUploadComplete(page: Page, expectedCount: number): Promise<void> {
    const maxWaitTime = IMAGE_UPLOAD_TIMEOUT_MS // 60초
    const startTime = Date.now()
    const MAX_NO_PROGRESS_COUNT = 40 // 20초간 진행 없으면 타임아웃 (500ms * 40)

    console.log(`[이미지업로드] ${expectedCount}개 이미지 업로드 대기 중 (최대 ${maxWaitTime / 1000}초)`)

    // 업로드 진행 상태 셀렉터
    const loadingIndicators = [
      '.uploading',
      '.progress',
      '[class*="loading"]',
      '.photoLoading',
      '.cPostWrite .loading',
      '.cPostWrite [class*="progress"]',
    ]

    let lastUploadedCount = -1
    let lastLoggedCount = -1
    let noProgressCount = 0
    let lastIsLoading = false

    while (Date.now() - startTime < maxWaitTime) {
      // 1. 로딩 인디케이터가 보이는지 확인
      let isLoading = false
      let loadingSelector = ''
      for (const selector of loadingIndicators) {
        try {
          const el = await page.$(selector)
          if (el && await el.isVisible()) {
            isLoading = true
            loadingSelector = selector
            break
          }
        } catch {
          // 무시
        }
      }

      // 로딩 상태 변화 시에만 로그 출력
      if (isLoading !== lastIsLoading) {
        if (isLoading) {
          console.log(`[이미지업로드] 업로드 진행 중... (${loadingSelector})`)
        } else {
          console.log(`[이미지업로드] 로딩 인디케이터 사라짐`)
        }
        lastIsLoading = isLoading
      }

      if (!isLoading) {
        // 2. 업로드된 이미지 수 확인
        const uploadedCount = await this.countUploadedImages(page)

        // 상태 변화 시에만 로그 출력
        if (uploadedCount !== lastLoggedCount) {
          console.log(`[이미지업로드] 업로드된 이미지: ${uploadedCount}/${expectedCount}`)
          lastLoggedCount = uploadedCount
        }

        // 진행 상태 체크
        if (uploadedCount === lastUploadedCount) {
          noProgressCount++
          // 5초마다 진행 없음 경고
          if (noProgressCount > 0 && noProgressCount % 10 === 0) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000)
            console.warn(`[이미지업로드] ${noProgressCount * 0.5}초간 진행 없음 (경과: ${elapsed}초)`)
          }
        } else {
          noProgressCount = 0
          lastUploadedCount = uploadedCount
        }

        // 진행 없이 너무 오래되면 조기 타임아웃
        if (noProgressCount >= MAX_NO_PROGRESS_COUNT) {
          console.warn(`[이미지업로드] ${MAX_NO_PROGRESS_COUNT * 0.5}초간 진행 없음 - 타임아웃`)
          break
        }

        if (uploadedCount >= expectedCount) {
          console.log(`[이미지업로드] 업로드 완료: ${uploadedCount}개`)

          // 3. 게시 버튼 활성화 확인 (추가 안전장치)
          const submitButton = await page.$('button._btnSubmitPost')
          if (submitButton) {
            const isEnabled = await submitButton.isEnabled().catch(() => false)
            if (isEnabled) {
              console.log('[이미지업로드] 게시 버튼 활성화 확인됨')
              return
            }
          }

          // 게시 버튼 활성화 대기 (최대 5초 추가)
          console.log('[이미지업로드] 게시 버튼 활성화 대기 중...')
          for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(500)
            const btn = await page.$('button._btnSubmitPost')
            if (btn && await btn.isEnabled().catch(() => false)) {
              console.log('[이미지업로드] 게시 버튼 활성화됨')
              return
            }
          }

          // 5초 후에도 버튼이 비활성화면 그냥 진행
          console.log('[이미지업로드] 게시 버튼이 비활성화 상태지만 계속 진행')
          return
        }
      } else {
        // 로딩 중일 때는 진행 카운터 리셋
        noProgressCount = 0
      }

      await page.waitForTimeout(500)
    }

    // 타임아웃 - 실패 처리
    const uploadedCount = await this.countUploadedImages(page)
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    console.error(`[이미지업로드] 타임아웃 (${elapsed}초). 업로드됨: ${uploadedCount}/${expectedCount}`)

    // 업로드된 이미지가 예상보다 적으면 에러
    if (uploadedCount < expectedCount) {
      throw new BandPlaywrightError(
        `이미지 업로드 실패: ${expectedCount}개 중 ${uploadedCount}개만 업로드됨 (타임아웃)`,
        BandPlaywrightErrorCode.UPLOAD_TIMEOUT
      )
    }
  }

  /**
   * 이미지 업로드 완료 대기 (진행률 콜백 포함)
   */
  private async waitForUploadCompleteWithProgress(
    page: Page,
    expectedCount: number,
    onProgress?: (current: number, total: number) => void | Promise<void>
  ): Promise<void> {
    const maxWaitTime = IMAGE_UPLOAD_TIMEOUT_MS
    const startTime = Date.now()
    const MAX_NO_PROGRESS_COUNT = 40

    console.log(`[이미지업로드] ${expectedCount}개 이미지 업로드 대기 중 (진행률 추적)`)

    const loadingIndicators = [
      '.uploading', '.progress', '[class*="loading"]',
      '.photoLoading', '.cPostWrite .loading', '.cPostWrite [class*="progress"]',
    ]

    let lastUploadedCount = -1
    let noProgressCount = 0
    let lastIsLoading = false

    while (Date.now() - startTime < maxWaitTime) {
      // 로딩 인디케이터 확인
      let isLoading = false
      for (const selector of loadingIndicators) {
        try {
          const el = await page.$(selector)
          if (el && await el.isVisible()) {
            isLoading = true
            break
          }
        } catch {
          // 무시
        }
      }

      if (isLoading !== lastIsLoading) {
        lastIsLoading = isLoading
      }

      if (!isLoading) {
        const uploadedCount = await this.countUploadedImages(page)

        // 진행률 콜백 호출 (업로드 수가 변경될 때)
        if (uploadedCount !== lastUploadedCount && onProgress) {
          await onProgress(uploadedCount, expectedCount)
        }

        if (uploadedCount === lastUploadedCount) {
          noProgressCount++
        } else {
          noProgressCount = 0
          lastUploadedCount = uploadedCount
        }

        if (noProgressCount >= MAX_NO_PROGRESS_COUNT) {
          console.warn(`[이미지업로드] ${MAX_NO_PROGRESS_COUNT * 0.5}초간 진행 없음 - 타임아웃`)
          break
        }

        if (uploadedCount >= expectedCount) {
          console.log(`[이미지업로드] 업로드 완료: ${uploadedCount}개`)
          if (onProgress) {
            await onProgress(expectedCount, expectedCount)
          }

          // 게시 버튼 활성화 확인
          const submitButton = await page.$('button._btnSubmitPost')
          if (submitButton && await submitButton.isEnabled().catch(() => false)) {
            return
          }

          // 게시 버튼 활성화 대기 (최대 5초)
          for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(500)
            const btn = await page.$('button._btnSubmitPost')
            if (btn && await btn.isEnabled().catch(() => false)) {
              return
            }
          }
          return
        }
      } else {
        noProgressCount = 0
      }

      await page.waitForTimeout(500)
    }

    // 타임아웃 - 실패 처리
    const uploadedCount = await this.countUploadedImages(page)
    if (onProgress) {
      await onProgress(uploadedCount, expectedCount)
    }
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    console.error(`[이미지업로드] 타임아웃 (${elapsed}초). 업로드됨: ${uploadedCount}/${expectedCount}`)

    // 업로드된 이미지가 예상보다 적으면 에러
    if (uploadedCount < expectedCount) {
      throw new BandPlaywrightError(
        `이미지 업로드 실패: ${expectedCount}개 중 ${uploadedCount}개만 업로드됨 (타임아웃)`,
        BandPlaywrightErrorCode.UPLOAD_TIMEOUT
      )
    }
  }

  /**
   * 팝업 내 이미지 업로드 완료 대기 후 "첨부하기" 클릭
   * 1. 팝업이 열렸는지 확인 (5초 대기)
   * 2. 팝업이 있으면 업로드 완료 대기 후 "첨부하기" 클릭
   * 3. 팝업이 없으면 인라인 업로드 방식으로 처리 (바로 return)
   */
  private async waitForPopupUploadAndAttach(page: Page, expectedCount: number): Promise<void> {
    const FORBIDDEN_TEXTS = ['게시', '등록', 'post', 'submit']
    // 이미지 개수에 따라 타임아웃 동적 조정 (기본 30초 + 이미지당 10초)
    const baseTimeout = 30000
    const perImageTimeout = 10000
    const maxWaitTime = baseTimeout + (expectedCount * perImageTimeout) // 10개면 130초
    const checkInterval = 500 // 500ms로 체크
    const startTime = Date.now()
    const NO_PROGRESS_TIMEOUT = 15000 // 15초간 진행 없으면 현재 개수로 진행

    console.log(`[밴드자동화] 업로드 타임아웃: ${maxWaitTime / 1000}초 (이미지 ${expectedCount}개)`)

    console.log(`[밴드자동화] 팝업 내 ${expectedCount}개 이미지 업로드 대기 중...`)

    // 팝업 셀렉터 (Band UI의 다양한 팝업 구조 지원)
    const popupSelectors = [
      '[role="dialog"]',
      '.uLayer',
      '.uLayerContainer',
      '.photoUploadLayer',
      '.photoAttachLayer',
      '.layerContainer[style*="display: block"]',
      // 사진 올리기 팝업 관련
      '[data-viewname*="Photo"]',
      '[data-viewname*="photo"]',
      '[data-viewname*="Attach"]',
      '.dPhotoUploadView',
      '.photoUploadWrap',
      // 레이어 팝업 (일반)
      '.uLayerView',
      '.layerPopup',
    ]

    // 1. 팝업이 열렸는지 먼저 확인 (최대 10초 대기)
    let popupFound = false
    const popupWaitStart = Date.now()
    while (Date.now() - popupWaitStart < 10000) {
      for (const selector of popupSelectors) {
        try {
          const popup = await page.$(selector)
          if (popup && await popup.isVisible()) {
            console.log(`[밴드자동화] 팝업 발견: ${selector}`)
            popupFound = true
            break
          }
        } catch { /* 무시 */ }
      }
      if (popupFound) break
      await page.waitForTimeout(300)
    }

    // 셀렉터로 못 찾으면 JavaScript로 팝업 찾기
    if (!popupFound) {
      console.log('[밴드자동화] 셀렉터로 팝업 못 찾음, JavaScript로 검색...')
      popupFound = await page.evaluate(() => {
        // 모든 요소에서 "사진 올리기" 텍스트를 포함한 팝업 찾기
        const allElements = document.querySelectorAll('*')
        for (const el of allElements) {
          const text = el.textContent || ''
          const className = el.className || ''
          const style = window.getComputedStyle(el)

          // 팝업 특성: position fixed/absolute, z-index 높음, "사진" 또는 "올리기" 텍스트
          if (
            (style.position === 'fixed' || style.position === 'absolute') &&
            parseInt(style.zIndex) > 100 &&
            (text.includes('사진') || text.includes('올리기') || text.includes('첨부') ||
             className.includes('Layer') || className.includes('layer') ||
             className.includes('Popup') || className.includes('popup'))
          ) {
            const rect = el.getBoundingClientRect()
            if (rect.width > 100 && rect.height > 100) {
              console.log('[JS] 팝업 발견:', className.substring(0, 50), rect.width, rect.height)
              return true
            }
          }
        }
        return false
      })

      if (popupFound) {
        console.log('[밴드자동화] JavaScript로 팝업 발견')
      }
    }

    // 팝업이 열리지 않으면 에러 (호출측에서 재시도)
    if (!popupFound) {
      console.error('[밴드자동화] 팝업이 열리지 않음 - 이미지 업로드 실패')
      // 디버그: 현재 페이지의 레이어 요소들 출력
      await page.evaluate(() => {
        const layers = document.querySelectorAll('[class*="layer"], [class*="Layer"], [class*="popup"], [class*="Popup"], [role="dialog"]')
        console.log('[DEBUG] 현재 페이지 레이어 요소:', layers.length)
        layers.forEach((el, i) => {
          const rect = el.getBoundingClientRect()
          console.log(`[DEBUG] ${i}: ${el.className.substring(0, 80)} - ${rect.width}x${rect.height}`)
        })
      })
      throw new BandPlaywrightError(
        '이미지 업로드 팝업이 열리지 않습니다. 페이지 새로고침 후 재시도해주세요.',
        BandPlaywrightErrorCode.UPLOAD_TIMEOUT
      )
    }

    // 팝업 내 업로드 진행 상태 확인 (로딩 인디케이터)
    const popupLoadingSelectors = [
      '[role="dialog"] .uploading',
      '[role="dialog"] .loading',
      '[role="dialog"] [class*="progress"]',
      '[role="dialog"] [class*="loading"]',
      '[role="dialog"] .spinner',
      '.uLayer .uploading',
      '.uLayer .loading',
      '.uLayer .spinner',
      // 업로드 진행 바
      '.photoUploadLayer [class*="progress"]',
      '.photoUploadLayer .loading',
    ]

    // 팝업 내 업로드된 이미지/썸네일 셀렉터 (다양한 Band UI 지원)
    const popupImageSelectors = [
      // role="dialog" 팝업
      '[role="dialog"] img[src*="phinf"]',
      '[role="dialog"] .thumbnail img',
      '[role="dialog"] .photoItem img',
      '[role="dialog"] .thumbItem img',
      '[role="dialog"] .previewItem img',
      // uLayer 팝업
      '.uLayer img[src*="phinf"]',
      '.uLayer .thumbnail img',
      '.uLayer .thumbItem img',
      // 사진 올리기 레이어
      '.photoUploadLayer .thumbItem',
      '.photoUploadLayer img',
      // blob URL 이미지 (업로드 중)
      '[role="dialog"] img[src*="blob:"]',
      '.uLayer img[src*="blob:"]',
    ]

    let uploadedCount = 0
    let lastUploadedCount = 0
    let lastProgressTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      // 로딩 중인지 확인
      let isLoading = false
      for (const selector of popupLoadingSelectors) {
        try {
          const loadingEl = await page.$(selector)
          if (loadingEl && await loadingEl.isVisible()) {
            isLoading = true
            break
          }
        } catch { /* 무시 */ }
      }

      // 업로드된 이미지 수 확인
      for (const selector of popupImageSelectors) {
        try {
          const images = await page.$$(selector)
          if (images.length > 0) {
            uploadedCount = images.length
            break
          }
        } catch { /* 무시 */ }
      }

      // 진행 상태 추적 - 이미지 수 증가 또는 로딩 중이면 시간 갱신
      if (uploadedCount > lastUploadedCount) {
        lastUploadedCount = uploadedCount
        lastProgressTime = Date.now()
        console.log(`[밴드자동화] 팝업 내 이미지 업로드 진행: ${uploadedCount}/${expectedCount}`)
      } else if (isLoading) {
        // 로딩 인디케이터가 보이면 업로드가 진행 중이므로 시간 갱신
        lastProgressTime = Date.now()
      }

      // 모든 이미지가 업로드되었거나, 로딩이 끝나고 진행이 멈춘 경우
      const allUploaded = uploadedCount >= expectedCount
      const noProgressTimeout = !isLoading && uploadedCount > 0 && (Date.now() - lastProgressTime > NO_PROGRESS_TIMEOUT)

      if (allUploaded || noProgressTimeout) {
        if (noProgressTimeout && uploadedCount < expectedCount) {
          console.warn(`[밴드자동화] 팝업 내 ${NO_PROGRESS_TIMEOUT/1000}초간 진행 없음 - ${uploadedCount}/${expectedCount}개로 계속 진행`)
        } else {
          console.log(`[밴드자동화] 팝업 내 ${uploadedCount}개 이미지 업로드 완료, 첨부하기 버튼 찾는 중...`)
        }

        // "첨부하기" 버튼 찾기
        const attachButtonSelector = 'button.uButton.-confirm._submitBtn'
        const buttons = await page.$$(attachButtonSelector)

        for (const btn of buttons) {
          try {
            const buttonText = (await btn.textContent())?.trim() || ''

            // "게시" 버튼이면 스킵
            if (FORBIDDEN_TEXTS.some(t => buttonText.toLowerCase().includes(t.toLowerCase()))) {
              continue
            }

            // "첨부하기" 텍스트인 버튼만 클릭
            if (buttonText === '첨부하기' || buttonText.includes('첨부하기')) {
              const isVisible = await btn.isVisible()
              if (isVisible) {
                console.log(`[밴드자동화] 첨부하기 버튼 클릭: "${buttonText}"`)
                await btn.click()
                await page.waitForTimeout(1500)
                return
              }
            }
          } catch { /* 무시 */ }
        }
      }

      // 대기 후 재시도
      await page.waitForTimeout(checkInterval)
    }

    // 타임아웃 - 첨부하기 버튼을 끝까지 찾지 못함
    throw new BandPlaywrightError(
      `팝업 내 이미지 업로드 시간 초과: ${expectedCount}개 중 ${uploadedCount}개만 업로드됨`,
      BandPlaywrightErrorCode.UPLOAD_TIMEOUT
    )
  }

  /**
   * "첨부하기" 버튼 클릭 (팝업이 있는 경우)
   * Band의 "사진 올리기" 팝업에서 첨부하기 버튼을 클릭
   * 주의: "게시" 버튼은 절대 클릭하지 않음! (같은 셀렉터를 공유함)
   */
  private async clickAttachButtonIfPresent(page: Page): Promise<void> {
    // "게시" 버튼은 절대 클릭하지 않음!
    const FORBIDDEN_TEXTS = ['게시', '등록', 'post', 'submit']
    const attachButtonSelector = 'button.uButton.-confirm._submitBtn'

    // 최대 5초 동안 "첨부하기" 버튼이 나타날 때까지 대기
    const maxWaitTime = 5000
    const checkInterval = 500
    const startTime = Date.now()

    console.log('[밴드자동화] 첨부하기 버튼 대기 중...')

    while (Date.now() - startTime < maxWaitTime) {
      // 모든 일치하는 버튼을 찾고, 텍스트가 "첨부하기"인 것만 클릭
      const buttons = await page.$$(attachButtonSelector)

      for (const btn of buttons) {
        try {
          const buttonText = (await btn.textContent())?.trim() || ''

          // "게시" 버튼이면 스킵
          if (FORBIDDEN_TEXTS.some(t => buttonText.toLowerCase().includes(t.toLowerCase()))) {
            continue
          }

          // "첨부하기" 텍스트인 버튼만 클릭
          if (buttonText === '첨부하기' || buttonText.includes('첨부하기')) {
            const isVisible = await btn.isVisible()
            if (isVisible) {
              console.log(`[밴드자동화] 첨부하기 버튼 발견: "${buttonText}", 클릭...`)
              await btn.click()
              await page.waitForTimeout(1500)
              return
            }
          }
        } catch {
          // 무시
        }
      }

      // 못 찾았으면 잠시 대기 후 재시도
      await page.waitForTimeout(checkInterval)
    }

    // 5초 후에도 못 찾으면 다른 방법 시도
    console.log('[밴드자동화] 첨부하기 버튼 대기 타임아웃, 다른 셀렉터 시도...')

    // 모든 버튼에서 "첨부하기" 텍스트 검색
    const allButtons = await page.$$('button')
    for (const btn of allButtons) {
      try {
        const buttonText = (await btn.textContent())?.trim() || ''

        // "게시" 버튼이면 스킵
        if (FORBIDDEN_TEXTS.some(t => buttonText.toLowerCase().includes(t.toLowerCase()))) {
          continue
        }

        if (buttonText === '첨부하기') {
          const isVisible = await btn.isVisible()
          if (isVisible) {
            console.log(`[밴드자동화] 첨부하기 버튼 발견 (일반 검색): "${buttonText}"`)
            await btn.click()
            await page.waitForTimeout(1500)
            return
          }
        }
      } catch {
        // 무시
      }
    }

    console.log('[밴드자동화] 첨부하기 버튼을 찾지 못함')
  }

  /**
   * 글씨 스타일 설정 (크게 + 볼드)
   * CKEditor 툴바에서 글씨 크기 "크게"와 볼드를 선택
   */
  private async setTextStyle(page: Page): Promise<void> {
    try {
      // 1. 글씨 크기 버튼 클릭 (span의 부모 a 태그)
      const fontSizeButton = await page.$('.cke_button__fontsize_icon')
      if (fontSizeButton) {
        console.log('[밴드자동화] 글씨 크기 버튼 발견')
        const parent = await fontSizeButton.$('xpath=..')
        if (parent) {
          await parent.click()
          await page.waitForTimeout(500)

          // 2. CKEditor 드롭다운은 iframe 안에 있음 - iframe 프레임 찾기
          const panelFrame = page.frameLocator('.cke_panel_frame')
          if (panelFrame) {
            // iframe 내부에서 "크게" 옵션 찾기
            const largeOption = panelFrame.locator('a[title="크게"]')
            if (await largeOption.count() > 0) {
              await largeOption.click()
              await page.waitForTimeout(300)
              console.log('[밴드자동화] 글씨 크기 "크게" 선택 완료 (iframe)')
            } else {
              // 텍스트로도 시도
              const largeByText = panelFrame.locator('a:has-text("크게")')
              if (await largeByText.count() > 0) {
                await largeByText.click()
                await page.waitForTimeout(300)
                console.log('[밴드자동화] 글씨 크기 "크게" 선택 완료 (텍스트)')
              } else {
                console.warn('[밴드자동화] iframe 내 "크게" 옵션을 찾을 수 없음')
              }
            }
          } else {
            console.warn('[밴드자동화] CKEditor 패널 iframe을 찾을 수 없음')
          }
        }
      } else {
        console.warn('[밴드자동화] 글씨 크기 버튼(.cke_button__fontsize_icon)을 찾을 수 없음')
      }

      // 3. 볼드 버튼 클릭 (span의 부모 a 태그)
      const boldButton = await page.$('.cke_button__bold_icon')
      if (boldButton) {
        console.log('[밴드자동화] 볼드 버튼 발견')
        const parent = await boldButton.$('xpath=..')
        if (parent) {
          await parent.click()
          await page.waitForTimeout(300)
          console.log('[밴드자동화] 볼드 선택 완료')
        }
      } else {
        console.warn('[밴드자동화] 볼드 버튼(.cke_button__bold_icon)을 찾을 수 없음')
      }
    } catch (error) {
      console.warn('[밴드자동화] 글씨 스타일 설정 실패 (무시하고 계속):', error)
    }
  }

  /**
   * 본문 입력
   * Band UI 패턴에 따라 레이어 팝업 내 에디터 또는 인라인 에디터에 입력
   */
  private async inputContent(page: Page, content: string): Promise<void> {
    // 사진 올리기 팝업이 열려있으면 먼저 닫기 (첨부하기 버튼 클릭 또는 취소)
    const photoDialog = await page.$('[role="dialog"]')
    if (photoDialog && await photoDialog.isVisible()) {
      console.log('[밴드자동화] 사진 올리기 팝업이 열려있음, 첨부하기 버튼 클릭 시도...')

      // 첨부하기/확인 버튼 찾기
      const confirmButton = await page.$('[role="dialog"] button.confirm, [role="dialog"] button._btnConfirmAttach')
      if (confirmButton && await confirmButton.isVisible()) {
        await confirmButton.click()
        await page.waitForTimeout(1500)
      } else {
        // 텍스트로 버튼 찾기
        const dialogButtons = await page.$$('[role="dialog"] button')
        for (const btn of dialogButtons) {
          const text = await btn.textContent()
          const buttonText = text?.trim() || ''
          if ((buttonText.includes('첨부') || buttonText.includes('확인') || buttonText === '완료' || buttonText === '올리기') && !buttonText.includes('취소')) {
            if (await btn.isVisible()) {
              console.log(`[밴드자동화] 팝업 닫기 버튼 클릭: "${buttonText}"`)
              await btn.click()
              await page.waitForTimeout(1500)
              break
            }
          }
        }
      }

      // 팝업이 닫혔는지 확인
      const stillOpen = await page.$('[role="dialog"]')
      if (stillOpen && await stillOpen.isVisible()) {
        // ESC 키로 닫기 시도
        console.log('[밴드자동화] 팝업이 아직 열려있음, ESC 키로 닫기 시도...')
        await page.keyboard.press('Escape')
        await page.waitForTimeout(1000)
      }
    }

    // 에디터 셀렉터 (우선순위 순 - 레이어 팝업 우선)
    const editorSelectors = [
      // 레이어 팝업 내 에디터 (우선순위 높음)
      '[data-viewname="DPostWriteLayerView"] [contenteditable="true"]',
      '.layerContainer [contenteditable="true"]',
      '.layerContainerView [contenteditable="true"]',
      // 인라인 에디터
      '.writeBody [contenteditable="true"]',
      '.postWriteBody [contenteditable="true"]',
      '[data-viewname*="PostWrite"] [contenteditable="true"]',
      '.cPostWrite [contenteditable="true"]',
      // 일반 contenteditable
      '[contenteditable="true"]',
      // textarea 폴백
      '.postEditor textarea',
      'textarea[placeholder*="글"]',
    ]

    let editor = null
    for (const selector of editorSelectors) {
      const candidates = await page.$$(selector)
      for (const candidate of candidates) {
        if (await candidate.isVisible()) {
          // 가짜 에디터(DPostFakeEditorView)가 아닌지 확인
          const isFakeEditor = await candidate.evaluate(el => {
            return !!el.closest('[data-viewname="DPostFakeEditorView"]')
          })
          if (!isFakeEditor) {
            editor = candidate
            console.log(`[밴드자동화] 에디터 발견: ${selector}`)
            break
          }
        }
      }
      if (editor) break
    }

    if (!editor) {
      await this.saveDebugScreenshot(page, 'editor-not-found')
      throw new BandPlaywrightError(
        '글 작성 영역을 찾을 수 없습니다.',
        BandPlaywrightErrorCode.POST_FAILED
      )
    }

    // contenteditable인 경우
    const isContentEditable = await editor.evaluate(el => el.getAttribute('contenteditable') === 'true')
    if (isContentEditable) {
      await editor.click()
      await page.waitForTimeout(300)

      // 글씨 스타일 설정 (크게 + 볼드) - 텍스트 입력 전에 설정
      await this.setTextStyle(page)

      // 타이핑으로 입력 (줄바꿈은 Enter로)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        await page.keyboard.type(lines[i], { delay: 10 })
        // 마지막 줄이 아니면 Enter
        if (i < lines.length - 1) {
          await page.keyboard.press('Enter')
        }
      }

      console.log('[밴드자동화] 키보드 입력으로 본문 작성 완료')
    } else {
      // textarea인 경우
      await editor.fill(content)
      console.log('[밴드자동화] textarea로 본문 작성 완료')
    }

    await page.waitForTimeout(1000)

    // 게시 버튼이 활성화될 때까지 대기
    try {
      await page.waitForSelector('button._btnSubmitPost:not([disabled])', { timeout: 5000 })
      console.log('[밴드자동화] 게시 버튼 활성화됨')
    } catch {
      console.warn('[밴드자동화] 게시 버튼이 아직 비활성화 상태일 수 있음')
    }
  }

  /**
   * 글쓰기 레이어에 첨부된 이미지가 있는지 확인
   * 레이어 팝업과 인라인 에디터 모두 확인
   */
  private async hasAttachedImages(page: Page): Promise<boolean> {
    // 레이어 팝업 내 이미지 확인 (우선순위 높음)
    const layerPopupSelectors = [
      '[data-viewname="DPostWriteLayerView"] .thumbList img',
      '[data-viewname="DPostWriteLayerView"] .photoList img',
      '[data-viewname="DPostWriteLayerView"] [class*="photo"] img',
      '[data-viewname="DPostWriteLayerView"] [class*="thumb"] img',
      '.layerContainer .thumbList img',
      '.layerContainer .photoList img',
    ]

    for (const selector of layerPopupSelectors) {
      const images = await page.$$(selector)
      const visibleImages = []
      for (const img of images) {
        if (await img.isVisible()) {
          visibleImages.push(img)
        }
      }
      if (visibleImages.length > 0) {
        console.log(`[밴드자동화] 발견 ${visibleImages.length} attached images in layer popup: ${selector}`)
        return true
      }
    }

    // 인라인 에디터 내 첨부된 이미지 확인
    const imageSelectors = [
      '.cPostWrite .thumbList img',
      '.cPostWrite .photoList img',
      '.cPostWrite .attachedPhoto img',
      '.cPostWrite [class*="photo"] img',
      '.cPostWrite [class*="thumb"] img',
      '.cPostWrite .imagePreview img',
    ]

    for (const selector of imageSelectors) {
      const images = await page.$$(selector)
      const visibleImages = []
      for (const img of images) {
        if (await img.isVisible()) {
          visibleImages.push(img)
        }
      }
      if (visibleImages.length > 0) {
        console.log(`[밴드자동화] 발견 ${visibleImages.length} attached images: ${selector}`)
        return true
      }
    }

    // 썸네일 개수 표시 확인
    const countSelectors = [
      '[data-viewname="DPostWriteLayerView"] [class*="photoCount"]',
      '[data-viewname="DPostWriteLayerView"] [class*="imageCount"]',
      '.cPostWrite [class*="photoCount"]',
      '.cPostWrite [class*="imageCount"]',
    ]

    for (const selector of countSelectors) {
      const thumbnailCount = await page.$eval(selector, (el) => el.textContent || '').catch(() => '')
      if (thumbnailCount && /\d+/.test(thumbnailCount)) {
        console.log(`[밴드자동화] 발견 thumbnail count indicator: ${thumbnailCount}`)
        return true
      }
    }

    return false
  }

  /**
   * 게시 버튼 클릭 (API 응답 모니터링 방식으로 개선)
   * Band API 응답을 직접 확인하여 정확한 성공/실패 판단
   */
  private async submitPost(page: Page): Promise<void> {
    // Band UI의 게시 버튼 셀렉터 (실제 클래스 기반)
    let submitButton = await page.$('button._btnSubmitPost')

    if (!submitButton) {
      throw new BandPlaywrightError(
        '게시 버튼을 찾을 수 없습니다.',
        BandPlaywrightErrorCode.POST_FAILED
      )
    }

    // 게시 버튼이 활성화될 때까지 대기 (최대 15초)
    console.log('[밴드자동화] 게시 버튼 활성화 대기...')
    for (let i = 0; i < 30; i++) {
      submitButton = await page.$('button._btnSubmitPost')
      if (submitButton) {
        const isEnabled = await submitButton.isEnabled().catch(() => false)
        if (isEnabled) {
          console.log(`[밴드자동화] 게시 버튼 활성화됨 (소요: ${i * 500}ms`)
          break
        }
      }
      await page.waitForTimeout(500)
    }

    const isVisible = await submitButton?.isVisible() ?? false
    const isEnabled = await submitButton?.isEnabled() ?? false
    console.log(`[밴드자동화] 게시 버튼 상태: visible=${isVisible}, enabled=${isEnabled}`)

    if (!isEnabled) {
      // 버튼이 비활성화된 경우 - 이미지 업로드 미완료 또는 내용 없음
      console.warn('[밴드자동화] Submit button still disabled, trying to enable by triggering input events')
      await this.saveDebugScreenshot(page, 'submit-button-disabled')

      // 에디터에 포커스를 주고 이벤트 트리거
      const editor = await page.$('.cPostWrite [contenteditable="true"]')
      if (editor) {
        await editor.click()
        await page.keyboard.press('Space')
        await page.keyboard.press('Backspace')
        await page.waitForTimeout(1000)
      }

      // 다시 확인
      submitButton = await page.$('button._btnSubmitPost')
      const stillDisabled = !(await submitButton?.isEnabled() ?? false)
      if (stillDisabled) {
        await this.saveDebugScreenshot(page, 'submit-button-still-disabled')
        throw new BandPlaywrightError(
          '게시 버튼이 활성화되지 않았습니다. 이미지 업로드가 완료되지 않았거나 내용이 없습니다.',
          BandPlaywrightErrorCode.POST_FAILED
        )
      }
    }

    // API 응답 모니터링 설정
    type ApiResponseType = { success: boolean; postNo?: number; error?: string } | null
    let apiResponse: ApiResponseType = null

    const responseHandler = async (response: import('playwright').Response) => {
      const url = response.url()
      // Band 게시 생성 API 엔드포인트
      if (url.includes('/create_post')) {
        try {
          const status = response.status()
          const json = await response.json().catch(() => null)

          console.log(`[밴드자동화] create_post API 응답 캡처: status=${status}`)

          if (status === 200 && json) {
            if (json.result_code === 1 && json.result_data?.post?.post_no) {
              apiResponse = {
                success: true,
                postNo: json.result_data.post.post_no,
              }
              console.log(`[밴드자동화] API 성공! post_no=${apiResponse.postNo}`)
            } else {
              apiResponse = {
                success: false,
                error: json.message || `result_code=${json.result_code}`,
              }
              console.log(`[밴드자동화] API 실패: ${apiResponse.error}`)
            }
          } else {
            apiResponse = { success: false, error: `HTTP ${status}` }
          }
        } catch (e) {
          console.warn('[밴드자동화] API 응답 파싱 실패:', e)
        }
      }
    }

    // 응답 리스너 등록
    page.on('response', responseHandler)

    try {
      // 버튼이 뷰포트에 보이도록 스크롤
      await submitButton!.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)

      console.log('[밴드자동화] API 모니터링과 함께 게시 버튼 클릭...')

      // 게시 버튼 클릭 (force 옵션)
      await submitButton!.click({ force: true, timeout: 5000 })
      console.log('[밴드자동화] 게시 버튼 클릭됨')

      // API 응답 대기 (최대 15초)
      for (let i = 0; i < 30; i++) {
        if (apiResponse !== null) {
          break
        }
        await page.waitForTimeout(500)
      }

      // API 응답으로 성공 판단
      const response = apiResponse as ApiResponseType // 명시적 타입 단언
      if (response !== null) {
        if (response.success) {
          console.log(`[밴드자동화] API로 게시물 생성 성공! post_no=${response.postNo}`)
          return // 성공
        } else {
          throw new BandPlaywrightError(
            `Band API 오류: ${response.error}`,
            BandPlaywrightErrorCode.POST_FAILED
          )
        }
      }

      // API 응답을 받지 못한 경우 - UI 기반 폴백 로직
      console.log('[밴드자동화] API 응답 없음, UI 확인으로 전환...')
      await this.submitPostFallbackCheck(page)

    } finally {
      // 리스너 제거
      page.off('response', responseHandler)
    }
  }

  /**
   * API 응답을 받지 못한 경우의 UI 기반 폴백 성공 판단
   * Band UI 패턴:
   * 1. 레이어 팝업 방식 (DPostWriteLayerView): 게시 성공 시 레이어가 닫힘
   * 2. 인라인 에디터 방식 (CKEditor): 게시 성공 시 에디터가 접히고 폼이 -standby 상태로
   */
  private async submitPostFallbackCheck(page: Page): Promise<void> {
    // 추가 대기
    await page.waitForTimeout(3000)

    // 게시 완료 확인 (최대 20초)
    for (let attempt = 0; attempt < 10; attempt++) {
      // 1. 레이어 팝업이 닫혔는지 확인 (가장 확실한 성공 지표)
      // 스크린샷 분석 결과, Band는 글쓰기 레이어 팝업을 사용함
      const writeLayerPopup = await page.$('[data-viewname="DPostWriteLayerView"]')
      if (!writeLayerPopup || !(await writeLayerPopup.isVisible().catch(() => false))) {
        // 레이어 팝업이 닫혔으면 성공
        console.log('[밴드자동화] 글쓰기 레이어 팝업 닫힘 - 게시 성공')
        return
      }

      // 2. layerContainer 내의 글쓰기 레이어 확인
      const layerContainer = await page.$('.layerContainer .cPostWrite, .layerContainerView .cPostWrite')
      if (layerContainer) {
        const isVisible = await layerContainer.isVisible().catch(() => false)
        if (!isVisible) {
          console.log('[밴드자동화] 레이어 컨테이너 닫힘 - 게시 성공')
          return
        }
      }

      // 3. 인라인 방식: CKEditor가 비활성화되었는지 확인
      const activeEditor = await page.$('.cPostWrite [contenteditable="true"].cke_editable.cke_focus')
      if (!activeEditor) {
        // CKEditor가 포커스를 잃음
        const anyEditor = await page.$('.cPostWrite [contenteditable="true"].cke_editable')
        // 중요: 레이어 팝업 내의 에디터인지 확인
        if (anyEditor) {
          const isInPopup = await anyEditor.evaluate(el => {
            return !!el.closest('[data-viewname="DPostWriteLayerView"]') ||
                   !!el.closest('.layerContainer') ||
                   !!el.closest('.layerContainerView')
          }).catch(() => false)

          // 레이어 팝업 내 에디터가 아직 보이면 실패
          if (isInPopup && await anyEditor.isVisible().catch(() => false)) {
            // 레이어 내 에디터가 아직 열려있음 - 계속 대기
            console.log(`[밴드자동화] 확인 ${attempt + 1}/10: Editor still in popup layer`)
          } else if (!await anyEditor.isVisible().catch(() => false)) {
            console.log('[밴드자동화] CKEditor 비활성화됨 - 게시 성공')
            return
          }
        } else {
          console.log('[밴드자동화] CKEditor 없음 - 게시 성공')
          return
        }
      }

      // 4. 폼이 -standby 상태로 돌아갔는지 확인 (인라인 방식에서만 유효)
      // 주의: 레이어 팝업 뒤에 있는 인라인 폼이 -standby 상태일 수 있으므로
      //       레이어 팝업이 닫혔는지 먼저 확인해야 함
      const standbyForm = await page.$('.postWriteForm.-standby')
      if (standbyForm) {
        // 이 폼이 레이어 팝업 뒤에 있는지 확인
        const isInPopup = await standbyForm.evaluate(el => {
          return !!el.closest('[data-viewname="DPostWriteLayerView"]') ||
                 !!el.closest('.layerContainer')
        }).catch(() => false)

        if (!isInPopup && await standbyForm.isVisible().catch(() => false)) {
          // 레이어 팝업 바깥의 폼이 -standby 상태 - 인라인 에디터가 접힘
          console.log('[밴드자동화] 폼이 대기 상태로 복귀 - 게시 성공')
          return
        }
      }

      // 5. 에디터 내용이 비었는지 확인 (게시 후 초기화됨)
      const contentAfter = await page.$eval(
        '.cPostWrite [contenteditable="true"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => '')

      const hasImages = await this.hasAttachedImages(page)

      console.log(`[밴드자동화] 확인 ${attempt + 1}/10: content="${contentAfter.substring(0, 30)}...", hasImages=${hasImages}`)

      // 레이어 팝업이 아직 열려있는 상태에서 내용만 비어있으면 아직 실패
      // (게시 클릭 후 처리 중일 수 있음)

      await page.waitForTimeout(2000)
    }

    // 마지막 확인: 토스트 메시지 확인
    const toastMessage = await page.$('.toastMsg, .toast, [class*="toast"]')
    if (toastMessage && await toastMessage.isVisible().catch(() => false)) {
      const text = await toastMessage.textContent()
      if (text?.includes('게시') || text?.includes('등록') || text?.includes('완료')) {
        console.log(`[밴드자동화] 토스트 메시지 발견: "${text}" - post successful`)
        return
      }
    }

    // 실패
    await this.saveDebugScreenshot(page, 'submit-failed-layer-open')

    throw new BandPlaywrightError(
      '게시물 등록에 실패했습니다. 글쓰기 레이어가 닫히지 않았거나 내용이 비워지지 않았습니다.',
      BandPlaywrightErrorCode.POST_FAILED
    )
  }

  /**
   * 현재 페이지에서 최신 게시물 postKey 가져오기
   */
  private async getLatestPostKey(page: Page, bandNo: string): Promise<string | null> {
    if (!bandNo) return null

    try {
      // 최근 게시물 링크에서 postKey 추출
      const postLink = await page.$(`a[href*="/band/${bandNo}/post/"]`)
      if (postLink) {
        const href = await postLink.getAttribute('href')
        const match = href?.match(/\/post\/(\d+)/)
        if (match) {
          return match[1]
        }
      }
    } catch {
      // 무시
    }
    return null
  }

  /**
   * 새 게시물 postKey 추출 (발행 전 postKey와 비교)
   */
  private async extractNewPostKey(page: Page, bandNo: string, beforePostKey: string | null): Promise<string> {
    const currentUrl = page.url()

    // URL에서 postKey 추출 (게시 후 해당 게시물 페이지로 이동한 경우)
    const postMatch = currentUrl.match(/\/post\/(\d+)/)
    if (postMatch && postMatch[1] !== beforePostKey) {
      console.log(`[밴드자동화] 새 postKey 추출됨 from URL: ${postMatch[1]}`)
      return postMatch[1]
    }

    // 최근 게시물에서 추출 시도
    const latestPostKey = await this.getLatestPostKey(page, bandNo)
    if (latestPostKey && latestPostKey !== beforePostKey) {
      console.log(`[밴드자동화] 새 postKey 추출됨 from recent post: ${latestPostKey}`)
      return latestPostKey
    }

    // 페이지 새로고침 후 다시 시도
    console.log('[밴드자동화] 새 postKey를 찾을 수 없음, 페이지 새로고침...')
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // 다시 시도
    const refreshedUrl = page.url()
    const refreshedMatch = refreshedUrl.match(/\/post\/(\d+)/)
    if (refreshedMatch && refreshedMatch[1] !== beforePostKey) {
      console.log(`[밴드자동화] 새 postKey 추출됨 after refresh: ${refreshedMatch[1]}`)
      return refreshedMatch[1]
    }

    // 최근 게시물 링크에서 다시 시도
    const refreshedLatestKey = await this.getLatestPostKey(page, bandNo)
    if (refreshedLatestKey && refreshedLatestKey !== beforePostKey) {
      console.log(`[밴드자동화] 새 postKey 추출됨 from refreshed page: ${refreshedLatestKey}`)
      return refreshedLatestKey
    }

    // 새 게시물이 없음 = 발행 실패
    throw new BandPlaywrightError(
      `게시물 발행에 실패했습니다. 새 게시물이 생성되지 않았습니다. (이전 postKey: ${beforePostKey})`,
      BandPlaywrightErrorCode.POST_FAILED
    )
  }

  /**
   * 파일 확장자 추출
   */
  private getExtension(url: string, contentType?: string | null): string {
    // Content-Type에서 추출
    if (contentType) {
      const typeMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
      }
      const ext = typeMap[contentType]
      if (ext) return ext
    }

    // URL에서 추출
    const urlMatch = url.match(/\.(jpg|jpeg|png|gif|webp)/i)
    if (urlMatch) {
      return urlMatch[1].toLowerCase()
    }

    return 'jpg'
  }

  /**
   * 임시 파일 정리
   */
  private cleanupTempFiles(files: string[]): void {
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file)
        }
      } catch (error) {
        console.error(`[밴드자동화] 임시 파일 정리 실패: ${file}`, error)
      }
    }
  }

  /**
   * 텍스트 전용 발행 (이미지 없이 쇼핑몰 링크 + 내용만)
   * 이미지 발행이 3분 타임아웃 시 폴백으로 사용
   */
  private async createTextOnlyPost(
    page: Page,
    content: string,
    shopUrl: string | undefined,
    currentBandNo: string,
    beforePostKey: string | null
  ): Promise<{ success: boolean; postKey?: string; error?: string }> {
    console.log('[BandPostAutomation] Creating text-only post (fallback mode)')

    try {
      // 기존 레이어 닫기
      await this.closeWriteLayerIfOpen(page)
      await page.waitForTimeout(1000)

      // 글쓰기 레이어 열기
      await this.openWriteLayer(page)

      // 쇼핑몰 링크가 있으면 본문 앞에 추가
      let finalContent = content
      if (shopUrl) {
        finalContent = `🛒 상품 구매하기: ${shopUrl}\n\n${content}`
      }

      // 본문 입력
      await this.inputContent(page, finalContent)
      await this.saveDebugScreenshot(page, 'text-only-content-entered')

      // 게시 버튼 클릭
      await this.submitPost(page)

      // 게시 완료 대기 및 postKey 추출
      await page.waitForTimeout(3000)
      const postKey = await this.extractNewPostKey(page, currentBandNo, beforePostKey)

      console.log(`[BandPostAutomation] Text-only post created: ${postKey}`)
      return { success: true, postKey }
    } catch (error: any) {
      console.error('[BandPostAutomation] Text-only post failed:', error)
      await this.saveDebugScreenshot(page, 'text-only-error')
      return { success: false, error: error.message }
    }
  }

  /**
   * 타임아웃과 함께 Promise 실행
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(errorMessage))
      }, timeoutMs)
    })

    try {
      const result = await Promise.race([promise, timeoutPromise])
      clearTimeout(timeoutId!)
      return result
    } catch (error) {
      clearTimeout(timeoutId!)
      throw error
    }
  }

  /**
   * 배치 발행: 같은 채널에 여러 상품을 효율적으로 발행
   * 페이지를 한 번만 열고, 밴드 페이지에 한 번만 이동하여 여러 글을 작성
   */
  async createBatchPosts(
    page: Page,
    params: BandBatchPublishParams
  ): Promise<BandBatchPublishResult> {
    const { bandKey, bandName, items, onItemSuccess, onProgress } = params
    const results: BandBatchItemResult[] = []
    let successCount = 0
    let failedCount = 0

    console.log(`[밴드자동화] 배치 발행 시작: ${items.length} items to band "${bandName}"`)

    try {
      // 1. 밴드 페이지로 한 번만 이동
      await this.navigateToBand(page, bandKey, bandName)

      // 현재 URL 확인 (로그인 리다이렉트 체크)
      const currentUrl = page.url()
      console.log(`[밴드자동화] 현재 URL: ${currentUrl}`)

      if (currentUrl.includes('signin') || currentUrl.includes('login')) {
        await this.saveDebugScreenshot(page, 'login-redirect')
        throw new BandPlaywrightError(
          '로그인이 필요합니다. 세션이 만료되었을 수 있습니다.',
          BandPlaywrightErrorCode.SESSION_EXPIRED
        )
      }

      // 현재 bandNo 추출
      const bandNoMatch = currentUrl.match(/\/band\/(\d+)/)
      const currentBandNo = bandNoMatch ? bandNoMatch[1] : ''

      // 2. 각 상품에 대해 글쓰기 반복
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const tempFiles: string[] = []

        console.log(`[밴드자동화] 발행 중 ${i + 1}/${items.length}: product ${item.productId}`)

        try {
          // 발행 전 최신 게시물 postKey 저장
          const beforePostKey = await this.getLatestPostKey(page, currentBandNo)
          console.log(`[밴드자동화] 발행 전 최신 postKey: ${beforePostKey || 'none'}`)

          await this.saveDebugScreenshot(page, `batch-${i + 1}-before`)

          // 2-1. 글쓰기 레이어 열기
          console.log('[밴드자동화] 글쓰기 레이어 열기')
          await this.openWriteLayer(page)

          // 2-2. 이미지 다운로드 (먼저 준비)
          const imagesToUpload = item.imageUrls.slice(0, MAX_IMAGES)
          let downloadedImages: string[] = []
          if (imagesToUpload.length > 0) {
            console.log(`[밴드자동화] 다운로드 중 ${imagesToUpload.length} images`)
            downloadedImages = await this.downloadImages(imagesToUpload)
            tempFiles.push(...downloadedImages)
          }

          // 2-3. 본문 입력 (이미지보다 먼저 입력 - 밴드에서 텍스트가 이미지 위에 표시됨)
          console.log('[밴드자동화] 본문 입력 중')
          await this.inputContent(page, item.content)

          // 2-4. 이미지 업로드 (본문 입력 후 - 이미지가 본문 아래에 배치됨)
          let uploadedImageCount = 0
          if (downloadedImages.length > 0) {
            console.log(`[밴드자동화] 다운로드 완료 ${downloadedImages.length} images, now uploading...`)
            await this.saveDebugScreenshot(page, `batch-${i + 1}-before-upload`)

            // 이미지 업로드 시도 (최대 2번)
            for (let uploadAttempt = 0; uploadAttempt < 2; uploadAttempt++) {
              try {
                uploadedImageCount = await this.uploadImagesWithVerification(page, downloadedImages)
                if (uploadedImageCount > 0) {
                  console.log(`[밴드자동화] 업로드 성공: ${uploadedImageCount} images`)
                  break
                }
              } catch (uploadError: any) {
                console.warn(`[밴드자동화] 이미지 업로드 시도 ${uploadAttempt + 1} failed:`, uploadError.message)
                if (uploadAttempt === 0) {
                  // 첫 번째 시도 실패 시, 글쓰기 레이어 닫고 다시 열기
                  console.log('[밴드자동화] 이미지 업로드 재시도...')
                  await page.keyboard.press('Escape')
                  await page.waitForTimeout(1000)
                  await this.openWriteLayer(page)
                  await page.waitForTimeout(1000)
                  // 본문 다시 입력
                  await this.inputContent(page, item.content)
                }
              }
            }

            await this.saveDebugScreenshot(page, `batch-${i + 1}-after-upload`)

            if (uploadedImageCount === 0) {
              console.warn(`[밴드자동화] 이미지 업로드 없음 (항목 ${i + 1}, continuing with text only`)
            }
          }

          // 2-5. 게시 버튼 클릭
          console.log('[밴드자동화] 게시물 제출 중')
          await this.submitPost(page)

          await this.saveDebugScreenshot(page, `batch-${i + 1}-after`)

          // 2-6. 게시 완료 대기 및 postKey 추출
          await page.waitForTimeout(3000)
          const postKey = await this.extractNewPostKey(page, currentBandNo, beforePostKey)

          console.log(`[BandPostAutomation] Item ${i + 1} published successfully: postKey=${postKey}, images=${uploadedImageCount}`)

          const itemResult: BandBatchItemResult = {
            productId: item.productId,
            success: true,
            postKey,
            imageCount: uploadedImageCount,
          }

          // 중요: onItemSuccess 콜백을 먼저 호출하여 DB 저장 수행
          // 이 콜백은 Band API 성공 직후 즉시 호출되어, 페이지 새로고침에 영향받지 않음
          if (onItemSuccess) {
            try {
              const publishedProductId = await onItemSuccess(itemResult)
              if (publishedProductId) {
                console.log(`[밴드자동화] DB 즉시 저장: publishedProductId=${publishedProductId}`)
              }
            } catch (dbError: any) {
              console.error(`[밴드자동화] DB 저장 실패 (상품 ${item.productId}:`, dbError.message)
              // DB 저장 실패해도 Band 발행은 성공했으므로 성공으로 처리
            }
          }

          results.push(itemResult)
          successCount++

          // 진행 상황 콜백 (UI 업데이트용, onItemSuccess 이후에 호출)
          if (onProgress) {
            await onProgress(i + 1, items.length, itemResult)
          }

        } catch (itemError: any) {
          console.error(`[BandPostAutomation] Item ${i + 1} failed:`, itemError.message)
          await this.saveDebugScreenshot(page, `batch-${i + 1}-error`)

          const itemResult: BandBatchItemResult = {
            productId: item.productId,
            success: false,
            error: itemError.message || '게시물 작성 실패',
          }
          results.push(itemResult)
          failedCount++

          // 진행 상황 콜백
          if (onProgress) {
            await onProgress(i + 1, items.length, itemResult)
          }

          // 세션 만료 에러면 전체 중단
          if (
            itemError instanceof BandPlaywrightError &&
            itemError.code === BandPlaywrightErrorCode.SESSION_EXPIRED
          ) {
            throw itemError
          }

          // 다른 에러는 계속 진행 - 페이지 상태 복구
          try {
            console.log('[밴드자동화] 오류 복구 중...')

            // 1. 글쓰기 레이어 강제 닫기
            await this.closeWriteLayerIfOpen(page)
            await page.waitForTimeout(1000)

            // 2. 페이지 새로고침 (상태 완전 초기화)
            console.log('[밴드자동화] 상태 초기화를 위해 페이지 새로고침')
            await page.reload({ waitUntil: 'networkidle' })
            await page.waitForTimeout(2000)

            // 3. 밴드 페이지가 아닌 경우 다시 이동
            const currentUrl = page.url()
            if (!currentUrl.includes(`/band/${currentBandNo}`)) {
              console.log('[밴드자동화] 밴드 페이지로 돌아가기')
              await this.navigateToBand(page, bandKey, bandName)
            }

            console.log('[밴드자동화] 복구 성공, 다음 항목 진행')
          } catch (navError) {
            console.error('[밴드자동화] 복구 실패:', navError)
            // 복구 실패 시 전체 중단
            break
          }
        } finally {
          // 임시 파일 정리
          this.cleanupTempFiles(tempFiles)
        }

        // 다음 게시물 전 짧은 대기 (Band 서버 부하 방지)
        if (i < items.length - 1) {
          console.log('[밴드자동화] 다음 게시물 전 2초 대기...')
          await page.waitForTimeout(2000)
        }
      }

    } catch (error: any) {
      console.error('[밴드자동화] 배치 발행 실패:', error)

      // 아직 처리되지 않은 항목들을 실패로 처리
      const processedCount = results.length
      for (let i = processedCount; i < items.length; i++) {
        results.push({
          productId: items[i].productId,
          success: false,
          error: error.message || '배치 발행 중단',
        })
        failedCount++
      }
    }

    console.log(`[밴드자동화] 배치 발행 완료: ${successCount} success, ${failedCount} failed`)

    return {
      success: failedCount === 0,
      total: items.length,
      successCount,
      failedCount,
      results,
    }
  }

  /**
   * 글쓰기 레이어가 열려있으면 닫기
   * 배치 발행 시 레이어 상태 정리용
   * Band UI 패턴:
   * 1. 레이어 팝업 방식 (DPostWriteLayerView): X 버튼으로 닫음
   * 2. 인라인 에디터 방식 (CKEditor): 취소 버튼으로 에디터를 닫음
   */
  private async closeWriteLayerIfOpen(page: Page): Promise<void> {
    // 1. 레이어 팝업 확인 (우선순위 높음)
    const writeLayerPopup = await page.$('[data-viewname="DPostWriteLayerView"]')
    if (writeLayerPopup && await writeLayerPopup.isVisible()) {
      console.log('[밴드자동화] 글쓰기 레이어 팝업 발견, 닫기 시도...')

      // 레이어 팝업의 닫기/취소 버튼 셀렉터
      const popupCloseSelectors = [
        '[data-viewname="DPostWriteLayerView"] button.close',
        '[data-viewname="DPostWriteLayerView"] button._btnClose',
        '[data-viewname="DPostWriteLayerView"] .btnClose',
        '.layerContainer button.close',
        '.layerContainer .btnLyClose',
        '.layerContainerView button.close',
      ]

      for (const selector of popupCloseSelectors) {
        const closeBtn = await page.$(selector)
        if (closeBtn && await closeBtn.isVisible()) {
          console.log(`[밴드자동화] 레이어 닫기 버튼 클릭: ${selector}`)
          await closeBtn.click()
          await page.waitForTimeout(1000)

          // 확인 대화상자가 나타나면 확인 버튼 클릭
          await this.clickConfirmDialogIfPresent(page)
          return
        }
      }

      // X 버튼을 찾지 못했으면 Escape 키 시도
      console.log('[밴드자동화] ESC 키로 레이어 팝업 닫기')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(1000)
      await this.clickConfirmDialogIfPresent(page)
      return
    }

    // 2. 인라인 에디터 확인
    const activeEditor = await page.$('.cPostWrite [contenteditable="true"].cke_editable')
    if (!activeEditor || !(await activeEditor.isVisible())) {
      // DPostEditorView 내부 에디터도 확인
      const editorViewEditor = await page.$('[data-viewname="DPostEditorView"] [contenteditable="true"]')
      if (!editorViewEditor || !(await editorViewEditor.isVisible())) {
        console.log('[밴드자동화] 닫을 활성 에디터 없음')
        return
      }
    }

    console.log('[밴드자동화] 활성 인라인 에디터 발견, 닫기 시도...')

    // 인라인 에디터의 취소 버튼 클릭
    const cancelButtonSelectors = [
      '.btnLyClose._btnCancel',        // 취소 버튼 (디버그에서 발견됨)
      'button._btnCancel',              // 취소 버튼
      '.cPostWrite button.close',       // 닫기 버튼
      '.cPostWrite ._btnClose',         // 닫기 버튼
    ]

    for (const selector of cancelButtonSelectors) {
      const cancelBtn = await page.$(selector)
      if (cancelBtn && await cancelBtn.isVisible()) {
        console.log(`[밴드자동화] 취소 버튼 클릭: ${selector}`)
        await cancelBtn.click()
        await page.waitForTimeout(1000)
        await this.clickConfirmDialogIfPresent(page)
        return
      }
    }

    // Escape 키 시도
    console.log('[밴드자동화] ESC 키로 에디터 닫기')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)
    await this.clickConfirmDialogIfPresent(page)
  }

  /**
   * 확인 대화상자가 나타나면 확인 버튼 클릭
   */
  private async clickConfirmDialogIfPresent(page: Page): Promise<void> {
    const confirmSelectors = [
      '.uLayer button.confirm',
      '.uLayer button._btnConfirm',
      '.layerContainer button.confirm',
      'button._btnConfirm',
      // "작성 중인 글이 있습니다" 확인 대화상자
      '.uModalBtnArea button.confirm',
    ]

    for (const selector of confirmSelectors) {
      const confirmBtn = await page.$(selector)
      if (confirmBtn && await confirmBtn.isVisible()) {
        console.log(`[밴드자동화] 작성 취소 다이얼로그 확인 버튼 클릭: ${selector}`)
        await confirmBtn.click()
        await page.waitForTimeout(500)
        return
      }
    }
  }

  /**
   * 글쓰기 레이어 열기 (배치용 - 별도 메서드)
   * Band UI 패턴:
   * 1. 레이어 팝업 방식 (DPostWriteLayerView): 글쓰기 버튼 클릭 시 팝업으로 열림
   * 2. 인라인 방식: DPostFakeEditorView 클릭 시 DPostEditorView가 확장됨
   */
  private async openWriteLayer(page: Page): Promise<void> {
    // 0. 먼저 기존에 열려있는 레이어가 있으면 닫기 (이전 발행 실패로 남아있을 수 있음)
    await this.closeWriteLayerIfOpen(page)
    await page.waitForTimeout(500)

    // 1. 이미 레이어 팝업이 열려있는지 확인
    const existingLayerPopup = await page.$('[data-viewname="DPostWriteLayerView"]')
    if (existingLayerPopup && await existingLayerPopup.isVisible()) {
      // 레이어 내의 에디터 찾기
      const popupEditor = await existingLayerPopup.$('[contenteditable="true"]')
      if (popupEditor && await popupEditor.isVisible()) {
        console.log('[밴드자동화] 에디터가 있는 레이어 팝업이 이미 열려있음')
        return
      }
    }

    // 2. 인라인 에디터가 이미 활성화되어 있는지 확인
    const activeEditorCheck = await page.$('.cPostWrite [contenteditable="true"].cke_editable')
    if (activeEditorCheck && await activeEditorCheck.isVisible()) {
      console.log('[밴드자동화] 에디터가 이미 활성화됨 (cke_editable found)')
      return
    }

    // DPostEditorView 내의 에디터 확인
    const editorViewCheck = await page.$('[data-viewname="DPostEditorView"] [contenteditable="true"]')
    if (editorViewCheck && await editorViewCheck.isVisible()) {
      console.log('[밴드자동화] 에디터가 이미 활성화됨 (DPostEditorView found)')
      return
    }

    // 3. 페이지 스크롤을 맨 위로 (글쓰기 영역이 보이도록)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1000)

    const currentUrl = page.url()
    console.log(`[밴드자동화] 현재 URL: ${currentUrl}`)

    // 4. 글쓰기 영역 클릭
    const writeAreaSelectors = [
      // 글쓰기 버튼 (레이어 팝업 열기)
      'button._btnOpenWriteLayer',
      'button._btnPostWrite',
      // 가짜 에디터 내부의 클릭 영역
      '.cPostWriteEventWrapper._btnOpenWriteLayer',
      // 가짜 에디터 영역 (피드 상단)
      '[data-viewname="DPostFakeEditorView"]',
      '.cPostWrite.gContentCardShadow',
      // 폴백
      '.writeBtn',
      '.postWriteInput',
    ]

    let clicked = false
    for (const selector of writeAreaSelectors) {
      try {
        const element = await page.$(selector)
        if (element && await element.isVisible()) {
          console.log(`[밴드자동화] 글쓰기 영역 발견: ${selector}, clicking...`)
          await this.saveDebugScreenshot(page, 'before-click-write-area')
          await element.click()
          clicked = true
          break
        }
      } catch (e) {
        console.log(`[밴드자동화] 셀렉터 ${selector} failed:`, (e as Error).message)
      }
    }

    if (!clicked) {
      // 마지막 시도: 페이지 새로고침 후 재시도
      console.log('[밴드자동화] 글쓰기 영역을 찾을 수 없음, 페이지 새로고침...')
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(500)

      for (const selector of writeAreaSelectors.slice(0, 5)) {
        try {
          const element = await page.$(selector)
          if (element && await element.isVisible()) {
            console.log(`[밴드자동화] 새로고침 후 글쓰기 영역 발견: ${selector}`)
            await element.click()
            clicked = true
            break
          }
        } catch (e) {
          // 무시
        }
      }
    }

    // 5. 에디터가 활성화될 때까지 대기 (최대 10초)
    console.log('[밴드자동화] 에디터 활성화 대기...')
    await this.saveDebugScreenshot(page, 'after-click-write-area')

    // 레이어 팝업 + 인라인 에디터 모두 확인
    const editorSelectors = [
      // 레이어 팝업 내 에디터 (우선 확인)
      '[data-viewname="DPostWriteLayerView"] [contenteditable="true"]',
      '.layerContainer [contenteditable="true"]',
      '.layerContainerView [contenteditable="true"]',
      // 인라인 에디터
      '.cPostWrite [contenteditable="true"].cke_editable',
      '[data-viewname="DPostEditorView"] [contenteditable="true"]',
      '.contentEditor._richEditor[contenteditable="true"]',
      '.cPostWrite .postWriteForm:not(.-standby) [contenteditable="true"]',
    ]

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500)

      for (const selector of editorSelectors) {
        const editor = await page.$(selector)
        if (editor && await editor.isVisible()) {
          console.log(`[밴드자동화] 에디터 활성화됨: ${selector}`)
          await page.waitForTimeout(500)
          return
        }
      }

      // 폴백: 레이어 팝업이 열렸는지 확인
      const layerPopup = await page.$('[data-viewname="DPostWriteLayerView"]')
      if (layerPopup && await layerPopup.isVisible()) {
        // 레이어가 열렸지만 에디터를 아직 못찾음 - 계속 대기
        console.log(`[밴드자동화] 레이어 팝업 표시됨, 에디터 대기... (${i + 1}/20)`)
        continue
      }

      // 폴백: 아무 contenteditable이라도 .cPostWrite 내부에 있으면 성공
      const fallbackEditor = await page.$('.cPostWrite [contenteditable="true"]')
      if (fallbackEditor && await fallbackEditor.isVisible()) {
        const isRealEditor = await fallbackEditor.evaluate(el => {
          const inFakeEditor = el.closest('[data-viewname="DPostFakeEditorView"]')
          return !inFakeEditor
        })
        if (isRealEditor) {
          console.log('[밴드자동화] 폴백: .cPostWrite에서 에디터 발견')
          await page.waitForTimeout(500)
          return
        }
      }
    }

    // 디버그 스크린샷
    await this.saveDebugScreenshot(page, 'write-layer-failed')

    throw new BandPlaywrightError(
      '글쓰기 레이어를 열 수 없습니다.',
      BandPlaywrightErrorCode.POST_FAILED
    )
  }

  /**
   * 게시물 삭제 (Playwright 사용)
   * postKey는 post_no (숫자 형태)
   */
  async deletePost(page: Page, bandKey: string, bandName: string, postKey: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[밴드자동화] 게시물 삭제 시작: bandName="${bandName}", postKey=${postKey}`)

    try {
      // 1. 먼저 밴드 페이지로 이동 (navigateToBand 사용)
      await this.navigateToBand(page, bandKey, bandName)

      // 현재 URL에서 band_no 추출
      const currentUrl = page.url()
      const bandNoMatch = currentUrl.match(/\/band\/(\d+)/)
      if (!bandNoMatch) {
        await this.saveDebugScreenshot(page, 'delete-no-band-no')
        return { success: false, error: '밴드 번호를 찾을 수 없습니다.' }
      }
      const bandNo = bandNoMatch[1]
      console.log(`[밴드자동화] 밴드 번호: ${bandNo}`)

      // 2. 해당 게시물 페이지로 이동
      const postUrl = `https://band.us/band/${bandNo}/post/${postKey}`
      console.log(`[밴드자동화] 게시물 페이지 이동: ${postUrl}`)

      await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)

      // 로그인 리다이렉트 확인
      const afterNavUrl = page.url()
      if (afterNavUrl.includes('signin') || afterNavUrl.includes('login')) {
        return { success: false, error: '로그인이 필요합니다. 세션이 만료되었을 수 있습니다.' }
      }

      // 게시물이 존재하지 않는 경우 (이미 삭제됨)
      const notFoundText = await page.$('text=삭제된 글입니다')
      const notFoundText2 = await page.$('text=존재하지 않는 글입니다')
      const notFoundText3 = await page.$('text=없는 게시글')
      if (notFoundText || notFoundText2 || notFoundText3) {
        console.log('[밴드자동화] 게시물이 이미 삭제되었거나 존재하지 않음')
        return { success: true } // 이미 삭제된 것으로 처리
      }

      await this.saveDebugScreenshot(page, 'delete-post-page')

      // 3. 더보기 메뉴 버튼 클릭
      const moreButtonSelectors = [
        'button._btnPostMore',
        '.postMore button',
        'button[class*="more"]',
        '.cPost ._btnMore',
        '.cPostBody button._btnMore',
        '[data-viewname="DPostView"] button._btnMore',
        '.cPostHeader button',
        'button.uButton.-more',
      ]

      let moreButtonClicked = false
      for (const selector of moreButtonSelectors) {
        const moreButton = await page.$(selector)
        if (moreButton && await moreButton.isVisible()) {
          console.log(`[밴드자동화] 더보기 버튼 클릭: ${selector}`)
          await moreButton.click()
          await page.waitForTimeout(1000)
          moreButtonClicked = true
          break
        }
      }

      if (!moreButtonClicked) {
        await this.saveDebugScreenshot(page, 'delete-no-more-button')
        return { success: false, error: '게시물 더보기 버튼을 찾을 수 없습니다.' }
      }

      await this.saveDebugScreenshot(page, 'delete-more-menu-opened')

      // 4. 삭제 메뉴 클릭
      // Band 더보기 메뉴 내에서 "삭제" 텍스트가 포함된 요소 찾기
      let deleteMenuClicked = false

      // 방법 1: 텍스트로 직접 찾기
      const deleteByText = await page.locator('text=삭제').first()
      if (await deleteByText.isVisible().catch(() => false)) {
        console.log('[밴드자동화] 삭제 메뉴 클릭: text=삭제')
        await deleteByText.click()
        await page.waitForTimeout(1000)
        deleteMenuClicked = true
      }

      // 방법 2: 셀렉터로 찾기
      if (!deleteMenuClicked) {
        const deleteMenuSelectors = [
          'button._btnDelete',
          'a._btnDelete',
          '.uLayerList li:has-text("삭제")',
          '.uLayerList button:has-text("삭제")',
          '.layerMenu li:has-text("삭제")',
          '.uLayer li:has-text("삭제")',
          '[class*="layer"] li:has-text("삭제")',
          '[class*="menu"] li:has-text("삭제")',
          'li button:has-text("삭제")',
          '[data-action="delete"]',
        ]

        for (const selector of deleteMenuSelectors) {
          try {
            const deleteMenu = await page.$(selector)
            if (deleteMenu && await deleteMenu.isVisible()) {
              console.log(`[밴드자동화] 삭제 메뉴 클릭: ${selector}`)
              await deleteMenu.click()
              await page.waitForTimeout(1000)
              deleteMenuClicked = true
              break
            }
          } catch {
            // 계속 시도
          }
        }
      }

      if (!deleteMenuClicked) {
        await this.saveDebugScreenshot(page, 'delete-no-delete-menu')
        return { success: false, error: '삭제 메뉴를 찾을 수 없습니다. 삭제 권한이 없을 수 있습니다.' }
      }

      // 5. 삭제 확인 다이얼로그에서 확인 버튼 클릭
      await page.waitForTimeout(500)
      await this.saveDebugScreenshot(page, 'delete-confirm-dialog')

      const confirmButtonSelectors = [
        'button._btnConfirm',
        '.uModalBtnArea button.confirm',
        '.uModal button:has-text("삭제")',
        '.layerContainer button.confirm',
        'button:has-text("확인")',
      ]

      let confirmClicked = false
      for (const selector of confirmButtonSelectors) {
        const confirmButton = await page.$(selector)
        if (confirmButton && await confirmButton.isVisible()) {
          const buttonText = await confirmButton.textContent()
          // "취소" 버튼이 아닌지 확인
          if (buttonText && !buttonText.includes('취소')) {
            console.log(`[밴드자동화] 삭제 확인 버튼 클릭: ${selector} (텍스트: ${buttonText})`)
            await confirmButton.click()
            await page.waitForTimeout(2000)
            confirmClicked = true
            break
          }
        }
      }

      if (!confirmClicked) {
        await this.saveDebugScreenshot(page, 'delete-no-confirm-button')
        return { success: false, error: '삭제 확인 버튼을 찾을 수 없습니다.' }
      }

      // 6. 삭제 성공 확인 (페이지가 리다이렉트되거나 토스트 메시지 확인)
      await page.waitForTimeout(2000)
      const afterUrl = page.url()

      // 게시물 페이지에서 벗어났으면 성공
      if (!afterUrl.includes(`/post/${postKey}`)) {
        console.log(`[밴드자동화] 게시물 삭제 성공: postKey=${postKey}`)
        return { success: true }
      }

      // 토스트 메시지 확인
      const successToast = await page.$('text=삭제되었습니다')
      if (successToast) {
        console.log(`[밴드자동화] 게시물 삭제 성공 (토스트 확인): postKey=${postKey}`)
        return { success: true }
      }

      console.log(`[밴드자동화] 게시물 삭제 완료 (추정): postKey=${postKey}`)
      return { success: true }

    } catch (error: any) {
      console.error('[밴드자동화] 게시물 삭제 실패:', error)
      await this.saveDebugScreenshot(page, 'delete-error')
      return { success: false, error: error.message || '게시물 삭제 중 오류가 발생했습니다.' }
    }
  }
}

export const postAutomation = new BandPostAutomation()
