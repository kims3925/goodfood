/**
 * 업로드 진행 상황 이벤트 발행기
 * band-post.automation.ts에서 발행 → publish.ts 파이프라인에서 구독
 */

import { EventEmitter } from 'events'

export interface UploadProgressInfo {
  fileIndex: string      // "1/10"
  totalPercent: string   // "10%"
  currentPercent: string // "92%"
  timestamp: number
}

class UploadProgressEmitter extends EventEmitter {
  private static instance: UploadProgressEmitter

  private constructor() {
    super()
    // 최대 리스너 수 늘리기
    this.setMaxListeners(20)
  }

  static getInstance(): UploadProgressEmitter {
    if (!UploadProgressEmitter.instance) {
      UploadProgressEmitter.instance = new UploadProgressEmitter()
    }
    return UploadProgressEmitter.instance
  }

  /**
   * 업로드 진행 정보 발행
   */
  emitProgress(progress: UploadProgressInfo): void {
    this.emit('uploadProgress', progress)
  }

  /**
   * 업로드 시작
   */
  emitStart(totalFiles: number): void {
    this.emit('uploadStart', { totalFiles, timestamp: Date.now() })
  }

  /**
   * 업로드 완료
   */
  emitComplete(): void {
    this.emit('uploadComplete', { timestamp: Date.now() })
  }
}

export const uploadProgressEmitter = UploadProgressEmitter.getInstance()
