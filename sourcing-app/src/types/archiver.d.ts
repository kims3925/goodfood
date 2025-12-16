declare module 'archiver' {
  import { Readable, Transform } from 'stream'

  interface ArchiverOptions {
    statConcurrency?: number
    allowHalfOpen?: boolean
    readableObjectMode?: boolean
    writeableObjectMode?: boolean
    decodeStrings?: boolean
    encoding?: BufferEncoding
    highWaterMark?: number
    objectMode?: boolean
    comment?: string
    forceLocalTime?: boolean
    forceZip64?: boolean
    store?: boolean
    zlib?: object
    gzip?: boolean
    gzipOptions?: object
  }

  interface EntryData {
    name?: string
    prefix?: string
    stats?: object
    date?: Date | string
    mode?: number
    store?: boolean
  }

  interface Archiver extends Transform {
    abort(): this
    append(source: Readable | Buffer | string, data?: EntryData): this
    directory(dirpath: string, destpath: string | false, data?: EntryData): this
    file(filepath: string, data?: EntryData): this
    glob(pattern: string, options?: object, data?: EntryData): this
    finalize(): Promise<void>
    pointer(): number
    use(plugin: Function): this
    symlink(filepath: string, target: string, mode?: number): this
  }

  function archiver(format: string, options?: ArchiverOptions): Archiver

  export = archiver
}
