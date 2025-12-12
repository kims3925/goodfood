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
  BandPlaywrightErrorCode
} from './types'

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
    console.log(`[밴드자동화] 밴드 이동: "${bandName}" (bandKey=${bandKey})`)

    // 방법 1: bandKey로 직접 URL 이동 시도 (가장 빠름)
    if (bandKey && bandKey.startsWith('AAC')) {
      console.log(`[밴드자동화] bandKey로 직접 URL 이동 시도...`)
      const directUrl = `https://band.us/band/${bandKey}`
      await page.goto(directUrl, {
        waitUntil: 'networkidle',
        timeout: POST_TIMEOUT_MS,
      })

      // 로그인 리다이렉트 체크
      const currentUrl = page.url()
      if (currentUrl.includes('signin') || currentUrl.includes('login')) {
        throw new BandPlaywrightError(
          '로그인이 필요합니다. 세션이 만료되었을 수 있습니다.',
          BandPlaywrightErrorCode.SESSION_EXPIRED
        )
      }

      // 밴드 페이지로 이동했는지 확인
      if (currentUrl.includes('/band/') && !currentUrl.includes('/home')) {
        console.log(`[밴드자동화] 밴드 페이지 이동 성공: ${currentUrl}`)
        await page.waitForTimeout(2000)
        await this.saveDebugScreenshot(page, 'band-direct-nav')
        return
      }

      console.log(`[밴드자동화] 직접 URL 이동 실패, 검색으로 전환...`)
    }

    // 방법 2: Band 홈에서 채널명으로 밴드 찾기 (폴백)
    console.log(`[밴드자동화] Band 홈에서 밴드 검색 중...`)
    await page.goto('https://band.us/home', {
      waitUntil: 'networkidle',
      timeout: POST_TIMEOUT_MS,
    })

    // 로그인 체크
    const currentUrl = page.url()
    if (currentUrl.includes('signin') || currentUrl.includes('login')) {
      throw new BandPlaywrightError(
        '로그인이 필요합니다. 세션이 만료되었을 수 있습니다.',
        BandPlaywrightErrorCode.SESSION_EXPIRED
      )
    }

    await page.waitForTimeout(2000)
    await this.saveDebugScreenshot(page, 'band-home')

    // 사이드바에서 채널명과 일치하는 밴드 찾기
    // 밴드 목록은 보통 사이드바에 있음
    const bandLinkSelector = `a[href*="/band/"]`

    // 모든 밴드 링크에서 텍스트와 href 수집
    const bandLinks = await page.$$eval(bandLinkSelector, (links) =>
      links.map((link) => ({
        href: link.getAttribute('href') || '',
        text: link.textContent?.trim() || '',
        // 이미지 alt도 체크 (밴드 아이콘에 이름이 있을 수 있음)
        imgAlt: link.querySelector('img')?.getAttribute('alt') || '',
      }))
    )

    console.log(`[밴드자동화] ${bandLinks.length}개 밴드 링크 발견`)

    // 채널명과 일치하는 링크 찾기 (정확히 일치하거나 포함)
    const matchedLink = bandLinks.find(
      (link) =>
        link.text === bandName ||
        link.text.includes(bandName) ||
        link.imgAlt === bandName ||
        link.imgAlt.includes(bandName)
    )

    if (matchedLink) {
      console.log(`[밴드자동화] 일치하는 밴드 발견: "${matchedLink.text || matchedLink.imgAlt}" -> ${matchedLink.href}`)

      // 해당 링크 클릭
      const linkElement = await page.$(`a[href="${matchedLink.href}"]`)
      if (linkElement) {
        await linkElement.click()
        await page.waitForLoadState('networkidle')
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
          await page.waitForLoadState('networkidle')
          console.log(`[밴드자동화] 밴드 페이지 이동 완료: ${page.url()}`)
          return
        }
      }
    }

    // 찾지 못한 경우 에러
    console.log(`[밴드자동화] 사용 가능한 밴드:`, bandLinks.map(l => l.text || l.imgAlt).join(', '))
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
    const { bandKey, bandName, content, imageUrls } = params
    const tempFiles: string[] = []

    try {
      console.log(`[밴드자동화] 게시물 작성 시작: ${bandName} (key: ${bandKey})`)
      console.log(`[밴드자동화] 내용 길이: ${content.length}, 이미지: ${imageUrls.length}개`)

      // 1. 밴드 페이지로 이동
      await this.navigateToBand(page, bandKey, bandName)

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

      // 방법 1: 글쓰기 버튼 클릭 (사이드바)
      const writeButton = await page.$('button._btnPostWrite')
      if (writeButton && await writeButton.isVisible()) {
        console.log('[밴드자동화] 사이드바 글쓰기 버튼 발견, 클릭...')
        await writeButton.click()
        await page.waitForTimeout(2000)
      } else {
        // 방법 2: 가짜 에디터 영역 클릭
        const fakeEditor = await page.$('[data-viewname="DPostFakeEditorView"], button._btnOpenWriteLayer')
        if (fakeEditor && await fakeEditor.isVisible()) {
          console.log('[밴드자동화] 에디터 영역 발견, 클릭...')
          await fakeEditor.click()
          await page.waitForTimeout(2000)
        } else {
          console.warn('[밴드자동화] 글쓰기 영역을 찾을 수 없음')
        }
      }

      await this.saveDebugScreenshot(page, 'step2-write-layer-opened')

      // 글쓰기 레이어가 열렸는지 확인 (레이어 팝업)
      const writeLayerSelectors = [
        '[data-viewname="DPostWriteLayerView"]',
        '.layerContainerView [data-viewname*="PostWrite"]',
        '.cPostWrite:not(.-standby)',
      ]

      let writeLayerOpened = false
      for (const selector of writeLayerSelectors) {
        const layer = await page.$(selector)
        if (layer && await layer.isVisible()) {
          writeLayerOpened = true
          console.log(`[밴드자동화] 글쓰기 레이어 열림: ${selector}`)
          break
        }
      }

      if (!writeLayerOpened) {
        console.warn('[밴드자동화] 글쓰기 레이어가 열리지 않았을 수 있음, 계속 진행...')
      }

      // 3. 이미지 다운로드 및 업로드
      const imagesToUpload = imageUrls.slice(0, MAX_IMAGES)
      if (imagesToUpload.length > 0) {
        console.log(`[밴드자동화] 3단계: ${imagesToUpload.length}개 이미지 다운로드`)
        const downloadedImages = await this.downloadImages(imagesToUpload)
        tempFiles.push(...downloadedImages)
        console.log(`[밴드자동화] ${downloadedImages.length}개 이미지 다운로드 완료`)

        if (downloadedImages.length > 0) {
          console.log('[밴드자동화] 4단계: 이미지 업로드')
          await this.uploadImages(page, downloadedImages)
          await this.saveDebugScreenshot(page, 'step4-images-uploaded')
        }
      }

      // 4. 본문 입력
      console.log('[밴드자동화] 5단계: 본문 입력')
      await this.inputContent(page, content)
      await this.saveDebugScreenshot(page, 'step5-content-entered')

      // 5. 게시 버튼 클릭
      console.log('[밴드자동화] 6단계: 게시물 등록')
      await this.submitPost(page)
      await this.saveDebugScreenshot(page, 'step6-post-submitted')

      // 6. 게시 완료 대기 및 postKey 추출
      await page.waitForTimeout(3000)
      // 새 게시물 postKey 추출 (이전 postKey와 비교하여 실제 발행 확인)
      const postKey = await this.extractNewPostKey(page, currentBandNo, beforePostKey)

      console.log(`[밴드자동화] 게시물 작성 성공: ${postKey}`)

      return {
        success: true,
        postKey,
        imageCount: tempFiles.length,
      }
    } catch (error: any) {
      console.error('[밴드자동화] 게시물 작성 실패:', error)
      await this.saveDebugScreenshot(page, 'error')

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
        console.log(`[밴드자동화] Converted relative URL: ${imageUrl} -> ${fullUrl}`)
      }

      const response = await fetch(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      })

      if (!response.ok) {
        console.error(`[밴드자동화] Failed to download image: ${imageUrl}`)
        return null
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const ext = this.getExtension(imageUrl, response.headers.get('content-type'))
      const tempPath = path.join(tempDir, `band_upload_${Date.now()}_${index}.${ext}`)

      fs.writeFileSync(tempPath, buffer)
      return tempPath
    } catch (error) {
      console.error(`[밴드자동화] Image download error: ${imageUrl}`, error)
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
    console.log(`[밴드자동화] Verified ${uploadedCount} images uploaded`)

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
          console.log(`[밴드자동화] Found ${visibleItems.length} uploaded images with: ${selector}`)
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
      // 레이어 팝업 내 사진 버튼
      '[data-viewname="DPostWriteLayerView"] button.photo',
      '[data-viewname="DPostWriteLayerView"] button[data-attachment="photo"]',
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

        // 파일 선택 후 잠시 대기
        await page.waitForTimeout(1500)

        // "첨부하기" 버튼 먼저 클릭
        await this.clickAttachButtonIfPresent(page)

        // 업로드 완료 대기
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

    // 파일 선택 후 잠시 대기 (Band UI가 파일 인식하도록)
    await page.waitForTimeout(1500)

    // "사진 올리기" 팝업에서 "첨부하기" 버튼 클릭 (먼저!)
    // Band는 파일 선택 후 "첨부하기" 버튼을 눌러야 이미지가 글쓰기 영역에 추가됨
    await this.clickAttachButtonIfPresent(page)

    // 첨부하기 버튼 클릭 후 업로드 완료 대기
    await this.waitForUploadComplete(page, imagePaths.length)
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

    // 타임아웃
    const uploadedCount = await this.countUploadedImages(page)
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    console.warn(`[이미지업로드] 타임아웃 (${elapsed}초). 업로드됨: ${uploadedCount}/${expectedCount}`)
  }

  /**
   * "첨부하기" 버튼 클릭 (팝업이 있는 경우)
   */
  private async clickAttachButtonIfPresent(page: Page): Promise<void> {
    // 다양한 "첨부하기" 버튼 셀렉터
    const attachButtonSelectors = [
      'button._btnConfirmAttach',
      '.layerFooter button.confirm',
      '.layerFooter button._confirm',
      '.photoAttachLayer button.confirm',
      '.uModalBtnArea button.confirm',
    ]

    for (const selector of attachButtonSelectors) {
      const attachButton = await page.$(selector)
      if (attachButton && await attachButton.isVisible()) {
        console.log(`[밴드자동화] Found attach button: ${selector}, clicking...`)
        await attachButton.click()
        await page.waitForTimeout(1500)
        return
      }
    }

    // 텍스트로 버튼 찾기
    const buttons = await page.$$('button')
    for (const btn of buttons) {
      try {
        const text = await btn.textContent()
        const buttonText = text?.trim() || ''
        if (
          (buttonText.includes('첨부하기') || buttonText.includes('확인') || buttonText === '완료') &&
          !buttonText.includes('취소')
        ) {
          const isVisible = await btn.isVisible()
          if (isVisible) {
            // 모달 내부의 버튼인지 확인 (레이어 팝업)
            const parentLayer = await btn.evaluate(el => {
              const layer = el.closest('.layerContainer, .uLayer, [class*="Layer"]')
              return layer ? layer.className : null
            })

            if (parentLayer) {
              console.log(`[밴드자동화] Found attach button by text: "${buttonText}" in layer: ${parentLayer}`)
              await btn.click()
              await page.waitForTimeout(1500)
              return
            }
          }
        }
      } catch {
        // 무시
      }
    }

    console.log('[밴드자동화] No attach button popup found (images may be attached directly)')
  }

  /**
   * 본문 입력
   * Band UI 패턴에 따라 레이어 팝업 내 에디터 또는 인라인 에디터에 입력
   */
  private async inputContent(page: Page, content: string): Promise<void> {
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
            console.log(`[밴드자동화] Found editor: ${selector}`)
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
      await page.waitForTimeout(500)

      // 실제 키보드 입력으로 내용 입력 (Band가 이벤트 감지하도록)
      // 먼저 기존 내용 삭제
      await page.keyboard.press('Control+a')
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(200)

      // 타이핑으로 입력 (줄바꿈은 Enter로)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        await page.keyboard.type(lines[i], { delay: 10 })
        // 마지막 줄이 아니면 Enter
        if (i < lines.length - 1) {
          await page.keyboard.press('Enter')
        }
      }

      console.log('[밴드자동화] Content entered via keyboard typing')
    } else {
      // textarea인 경우
      await editor.fill(content)
      console.log('[밴드자동화] Content entered via textarea')
    }

    await page.waitForTimeout(1000)

    // 게시 버튼이 활성화될 때까지 대기
    try {
      await page.waitForSelector('button._btnSubmitPost:not([disabled])', { timeout: 5000 })
      console.log('[밴드자동화] Submit button is now enabled')
    } catch {
      console.warn('[밴드자동화] Submit button may still be disabled')
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
        console.log(`[밴드자동화] Found ${visibleImages.length} attached images in layer popup: ${selector}`)
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
        console.log(`[밴드자동화] Found ${visibleImages.length} attached images: ${selector}`)
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
        console.log(`[밴드자동화] Found thumbnail count indicator: ${thumbnailCount}`)
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
    console.log('[밴드자동화] Waiting for submit button to be enabled...')
    for (let i = 0; i < 30; i++) {
      submitButton = await page.$('button._btnSubmitPost')
      if (submitButton) {
        const isEnabled = await submitButton.isEnabled().catch(() => false)
        if (isEnabled) {
          console.log(`[밴드자동화] Submit button enabled after ${i * 500}ms`)
          break
        }
      }
      await page.waitForTimeout(500)
    }

    const isVisible = await submitButton?.isVisible() ?? false
    const isEnabled = await submitButton?.isEnabled() ?? false
    console.log(`[밴드자동화] Submit button status: visible=${isVisible}, enabled=${isEnabled}`)

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

          console.log(`[밴드자동화] Captured create_post API response: status=${status}`)

          if (status === 200 && json) {
            if (json.result_code === 1 && json.result_data?.post?.post_no) {
              apiResponse = {
                success: true,
                postNo: json.result_data.post.post_no,
              }
              console.log(`[밴드자동화] API success! post_no=${apiResponse.postNo}`)
            } else {
              apiResponse = {
                success: false,
                error: json.message || `result_code=${json.result_code}`,
              }
              console.log(`[밴드자동화] API failed: ${apiResponse.error}`)
            }
          } else {
            apiResponse = { success: false, error: `HTTP ${status}` }
          }
        } catch (e) {
          console.warn('[밴드자동화] Failed to parse API response:', e)
        }
      }
    }

    // 응답 리스너 등록
    page.on('response', responseHandler)

    try {
      // 버튼이 뷰포트에 보이도록 스크롤
      await submitButton!.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)

      console.log('[밴드자동화] Clicking submit button with API monitoring...')

      // 게시 버튼 클릭 (force 옵션)
      await submitButton!.click({ force: true, timeout: 5000 })
      console.log('[밴드자동화] Submit button clicked')

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
          console.log(`[밴드자동화] Post created successfully via API! post_no=${response.postNo}`)
          return // 성공
        } else {
          throw new BandPlaywrightError(
            `Band API 오류: ${response.error}`,
            BandPlaywrightErrorCode.POST_FAILED
          )
        }
      }

      // API 응답을 받지 못한 경우 - UI 기반 폴백 로직
      console.log('[밴드자동화] No API response captured, falling back to UI check...')
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
        console.log('[밴드자동화] Write layer popup closed - post successful')
        return
      }

      // 2. layerContainer 내의 글쓰기 레이어 확인
      const layerContainer = await page.$('.layerContainer .cPostWrite, .layerContainerView .cPostWrite')
      if (layerContainer) {
        const isVisible = await layerContainer.isVisible().catch(() => false)
        if (!isVisible) {
          console.log('[밴드자동화] Layer container closed - post successful')
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
            console.log(`[밴드자동화] Check ${attempt + 1}/10: Editor still in popup layer`)
          } else if (!await anyEditor.isVisible().catch(() => false)) {
            console.log('[밴드자동화] CKEditor deactivated - post successful')
            return
          }
        } else {
          console.log('[밴드자동화] No CKEditor found - post successful')
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
          console.log('[밴드자동화] Form returned to standby (inline) - post successful')
          return
        }
      }

      // 5. 에디터 내용이 비었는지 확인 (게시 후 초기화됨)
      const contentAfter = await page.$eval(
        '.cPostWrite [contenteditable="true"]',
        (el) => el.textContent?.trim() || ''
      ).catch(() => '')

      const hasImages = await this.hasAttachedImages(page)

      console.log(`[밴드자동화] Check ${attempt + 1}/10: content="${contentAfter.substring(0, 30)}...", hasImages=${hasImages}`)

      // 레이어 팝업이 아직 열려있는 상태에서 내용만 비어있으면 아직 실패
      // (게시 클릭 후 처리 중일 수 있음)

      await page.waitForTimeout(2000)
    }

    // 마지막 확인: 토스트 메시지 확인
    const toastMessage = await page.$('.toastMsg, .toast, [class*="toast"]')
    if (toastMessage && await toastMessage.isVisible().catch(() => false)) {
      const text = await toastMessage.textContent()
      if (text?.includes('게시') || text?.includes('등록') || text?.includes('완료')) {
        console.log(`[밴드자동화] Toast message found: "${text}" - post successful`)
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
      console.log(`[밴드자동화] Extracted NEW postKey from URL: ${postMatch[1]}`)
      return postMatch[1]
    }

    // 최근 게시물에서 추출 시도
    const latestPostKey = await this.getLatestPostKey(page, bandNo)
    if (latestPostKey && latestPostKey !== beforePostKey) {
      console.log(`[밴드자동화] Extracted NEW postKey from recent post: ${latestPostKey}`)
      return latestPostKey
    }

    // 페이지 새로고침 후 다시 시도
    console.log('[밴드자동화] New postKey not found, refreshing page...')
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // 다시 시도
    const refreshedUrl = page.url()
    const refreshedMatch = refreshedUrl.match(/\/post\/(\d+)/)
    if (refreshedMatch && refreshedMatch[1] !== beforePostKey) {
      console.log(`[밴드자동화] Extracted NEW postKey after refresh: ${refreshedMatch[1]}`)
      return refreshedMatch[1]
    }

    // 최근 게시물 링크에서 다시 시도
    const refreshedLatestKey = await this.getLatestPostKey(page, bandNo)
    if (refreshedLatestKey && refreshedLatestKey !== beforePostKey) {
      console.log(`[밴드자동화] Extracted NEW postKey from refreshed page: ${refreshedLatestKey}`)
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
        console.error(`[밴드자동화] Failed to cleanup temp file: ${file}`, error)
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

    console.log(`[밴드자동화] Starting batch publish: ${items.length} items to band "${bandName}"`)

    try {
      // 1. 밴드 페이지로 한 번만 이동
      await this.navigateToBand(page, bandKey, bandName)

      // 현재 URL 확인 (로그인 리다이렉트 체크)
      const currentUrl = page.url()
      console.log(`[밴드자동화] Current URL: ${currentUrl}`)

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

        console.log(`[밴드자동화] Publishing item ${i + 1}/${items.length}: product ${item.productId}`)

        try {
          // 발행 전 최신 게시물 postKey 저장
          const beforePostKey = await this.getLatestPostKey(page, currentBandNo)
          console.log(`[밴드자동화] Latest postKey before publish: ${beforePostKey || 'none'}`)

          await this.saveDebugScreenshot(page, `batch-${i + 1}-before`)

          // 2-1. 글쓰기 레이어 열기
          console.log('[밴드자동화] Opening write layer')
          await this.openWriteLayer(page)

          // 2-2. 이미지 다운로드 (먼저 준비)
          const imagesToUpload = item.imageUrls.slice(0, MAX_IMAGES)
          let downloadedImages: string[] = []
          if (imagesToUpload.length > 0) {
            console.log(`[밴드자동화] Downloading ${imagesToUpload.length} images`)
            downloadedImages = await this.downloadImages(imagesToUpload)
            tempFiles.push(...downloadedImages)
          }

          // 2-3. 본문 입력 (이미지보다 먼저 입력 - 밴드에서 텍스트가 이미지 위에 표시됨)
          console.log('[밴드자동화] Inputting content')
          await this.inputContent(page, item.content)

          // 2-4. 이미지 업로드 (본문 입력 후 - 이미지가 본문 아래에 배치됨)
          let uploadedImageCount = 0
          if (downloadedImages.length > 0) {
            console.log(`[밴드자동화] Downloaded ${downloadedImages.length} images, now uploading...`)
            await this.saveDebugScreenshot(page, `batch-${i + 1}-before-upload`)

            // 이미지 업로드 시도 (최대 2번)
            for (let uploadAttempt = 0; uploadAttempt < 2; uploadAttempt++) {
              try {
                uploadedImageCount = await this.uploadImagesWithVerification(page, downloadedImages)
                if (uploadedImageCount > 0) {
                  console.log(`[밴드자동화] Successfully uploaded ${uploadedImageCount} images`)
                  break
                }
              } catch (uploadError: any) {
                console.warn(`[밴드자동화] Image upload attempt ${uploadAttempt + 1} failed:`, uploadError.message)
                if (uploadAttempt === 0) {
                  // 첫 번째 시도 실패 시, 글쓰기 레이어 닫고 다시 열기
                  console.log('[밴드자동화] Retrying image upload...')
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
              console.warn(`[밴드자동화] No images uploaded for item ${i + 1}, continuing with text only`)
            }
          }

          // 2-5. 게시 버튼 클릭
          console.log('[밴드자동화] Submitting post')
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
                console.log(`[밴드자동화] DB saved immediately: publishedProductId=${publishedProductId}`)
              }
            } catch (dbError: any) {
              console.error(`[밴드자동화] DB save failed for product ${item.productId}:`, dbError.message)
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
            console.log('[밴드자동화] Recovering from error...')

            // 1. 글쓰기 레이어 강제 닫기
            await this.closeWriteLayerIfOpen(page)
            await page.waitForTimeout(1000)

            // 2. 페이지 새로고침 (상태 완전 초기화)
            console.log('[밴드자동화] Refreshing page to reset state')
            await page.reload({ waitUntil: 'networkidle' })
            await page.waitForTimeout(2000)

            // 3. 밴드 페이지가 아닌 경우 다시 이동
            const currentUrl = page.url()
            if (!currentUrl.includes(`/band/${currentBandNo}`)) {
              console.log('[밴드자동화] Navigating back to band page')
              await this.navigateToBand(page, bandKey, bandName)
            }

            console.log('[밴드자동화] Recovery successful, continuing with next item')
          } catch (navError) {
            console.error('[밴드자동화] Failed to recover:', navError)
            // 복구 실패 시 전체 중단
            break
          }
        } finally {
          // 임시 파일 정리
          this.cleanupTempFiles(tempFiles)
        }

        // 다음 게시물 전 짧은 대기 (Band 서버 부하 방지)
        if (i < items.length - 1) {
          console.log('[밴드자동화] Waiting 2s before next post...')
          await page.waitForTimeout(2000)
        }
      }

    } catch (error: any) {
      console.error('[밴드자동화] Batch publish failed:', error)

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

    console.log(`[밴드자동화] Batch publish completed: ${successCount} success, ${failedCount} failed`)

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
      console.log('[밴드자동화] Write layer popup found, attempting to close...')

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
          console.log(`[밴드자동화] Clicking layer close button: ${selector}`)
          await closeBtn.click()
          await page.waitForTimeout(1000)

          // 확인 대화상자가 나타나면 확인 버튼 클릭
          await this.clickConfirmDialogIfPresent(page)
          return
        }
      }

      // X 버튼을 찾지 못했으면 Escape 키 시도
      console.log('[밴드자동화] Pressing Escape to close layer popup')
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
        console.log('[밴드자동화] No active editor to close')
        return
      }
    }

    console.log('[밴드자동화] Active inline editor found, attempting to close...')

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
        console.log(`[밴드자동화] Clicking cancel button: ${selector}`)
        await cancelBtn.click()
        await page.waitForTimeout(1000)
        await this.clickConfirmDialogIfPresent(page)
        return
      }
    }

    // Escape 키 시도
    console.log('[밴드자동화] Pressing Escape to close editor')
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
        console.log(`[밴드자동화] Clicking confirm button on discard dialog: ${selector}`)
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
        console.log('[밴드자동화] Layer popup already open with editor')
        return
      }
    }

    // 2. 인라인 에디터가 이미 활성화되어 있는지 확인
    const activeEditorCheck = await page.$('.cPostWrite [contenteditable="true"].cke_editable')
    if (activeEditorCheck && await activeEditorCheck.isVisible()) {
      console.log('[밴드자동화] Editor already active (cke_editable found)')
      return
    }

    // DPostEditorView 내의 에디터 확인
    const editorViewCheck = await page.$('[data-viewname="DPostEditorView"] [contenteditable="true"]')
    if (editorViewCheck && await editorViewCheck.isVisible()) {
      console.log('[밴드자동화] Editor already active (DPostEditorView found)')
      return
    }

    // 3. 페이지 스크롤을 맨 위로 (글쓰기 영역이 보이도록)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1000)

    const currentUrl = page.url()
    console.log(`[밴드자동화] Current URL: ${currentUrl}`)

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
          console.log(`[밴드자동화] Found write area: ${selector}, clicking...`)
          await this.saveDebugScreenshot(page, 'before-click-write-area')
          await element.click()
          clicked = true
          break
        }
      } catch (e) {
        console.log(`[밴드자동화] Selector ${selector} failed:`, (e as Error).message)
      }
    }

    if (!clicked) {
      // 마지막 시도: 페이지 새로고침 후 재시도
      console.log('[밴드자동화] No write area found, refreshing page...')
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(500)

      for (const selector of writeAreaSelectors.slice(0, 5)) {
        try {
          const element = await page.$(selector)
          if (element && await element.isVisible()) {
            console.log(`[밴드자동화] Found write area after refresh: ${selector}`)
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
    console.log('[밴드자동화] Waiting for editor to become active...')
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
          console.log(`[밴드자동화] Editor activated: ${selector}`)
          await page.waitForTimeout(500)
          return
        }
      }

      // 폴백: 레이어 팝업이 열렸는지 확인
      const layerPopup = await page.$('[data-viewname="DPostWriteLayerView"]')
      if (layerPopup && await layerPopup.isVisible()) {
        // 레이어가 열렸지만 에디터를 아직 못찾음 - 계속 대기
        console.log(`[밴드자동화] Layer popup visible, waiting for editor... (${i + 1}/20)`)
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
          console.log('[밴드자동화] Fallback: Editor found in .cPostWrite')
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
}

export const postAutomation = new BandPostAutomation()
