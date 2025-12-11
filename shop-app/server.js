const { createServer } = require('https')
const { parse } = require('url')
const next = require('next')
const fs = require('fs')
const { execSync } = require('child_process')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

// 임시 자체 서명 인증서 생성 (없는 경우)
const certDir = './.cert'
const keyPath = `${certDir}/localhost-key.pem`
const certPath = `${certDir}/localhost-cert.pem`

if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir)
}

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.log('🔐 자체 서명 인증서 생성 중...')

  try {
    // OpenSSL로 자체 서명 인증서 생성
    execSync(`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \
      -keyout ${keyPath} -out ${certPath} -days 365`, { stdio: 'inherit' })

    console.log('✅ 인증서 생성 완료')
  } catch (error) {
    console.error('❌ 인증서 생성 실패:', error.message)
    process.exit(1)
  }
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
}

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`\n🚀 HTTPS 서버가 시작되었습니다!`)
      console.log(`   - 로컬: https://${hostname}:${port}`)
      console.log(`\n⚠️  자체 서명 인증서를 사용 중입니다.`)
      console.log(`   브라우저에서 "안전하지 않음" 경고가 나타나면 "고급" → "계속 진행"을 클릭하세요.\n`)
    })
})
