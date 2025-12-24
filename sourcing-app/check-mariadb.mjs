import mysql from 'mysql2/promise'

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'banduser',
    password: 'band1234!',
    database: 'sourcing_db'
  })

  console.log('Checking published_product table...\n')

  // 전체 레코드 수
  const [totalResult] = await connection.query('SELECT COUNT(*) as total FROM published_product')
  console.log(`Total published_products: ${totalResult[0].total}\n`)

  // channelId가 null인 레코드 수
  const [nullChannelResult] = await connection.query('SELECT COUNT(*) as count FROM published_product WHERE channel_id IS NULL')
  console.log(`Records with channelId = null: ${nullChannelResult[0].count}`)

  // shopId가 null인 레코드 수
  const [nullShopResult] = await connection.query('SELECT COUNT(*) as count FROM published_product WHERE shop_id IS NULL')
  console.log(`Records with shopId = null: ${nullShopResult[0].count}`)

  // channelId와 shopId 모두 null인 레코드 수
  const [bothNullResult] = await connection.query('SELECT COUNT(*) as count FROM published_product WHERE channel_id IS NULL AND shop_id IS NULL')
  console.log(`Records with both null: ${bothNullResult[0].count}\n`)

  // 샘플 데이터 조회 (최근 20개)
  console.log('Sample data (recent 20 records):')
  console.log('='.repeat(150))
  const [samples] = await connection.query(`
    SELECT
      id,
      user_id as userId,
      product_id as productId,
      channel_id as channelId,
      shop_id as shopId,
      product_name as productName,
      published_at as publishedAt,
      created_at as createdAt
    FROM published_product
    ORDER BY created_at DESC
    LIMIT 20
  `)
  console.table(samples)

  // channelId가 null인 샘플
  const nullChannelCount = nullChannelResult[0].count
  if (nullChannelCount > 0) {
    console.log('\n\nRecords with channelId = null (sample 10):')
    console.log('='.repeat(150))
    const [nullChannelSamples] = await connection.query(`
      SELECT
        id,
        user_id as userId,
        product_id as productId,
        channel_id as channelId,
        shop_id as shopId,
        product_name as productName,
        published_at as publishedAt,
        created_at as createdAt
      FROM published_product
      WHERE channel_id IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `)
    console.table(nullChannelSamples)
  }

  await connection.end()
}

main().catch(console.error)
