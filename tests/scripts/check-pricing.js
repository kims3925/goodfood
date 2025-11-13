const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCurrentPricing() {
  console.log('🔍 현재 수집된 게시물 가격 정보 확인...\n');

  const posts = await prisma.collectedPost.findMany({
    include: {
      wholesaleBand: {
        select: { name: true, pricingPolicy: true }
      }
    },
    orderBy: { bandCreatedAt: 'desc' }
  });

  console.log(`총 ${posts.length}개의 수집된 게시물 발견\n`);

  // 나은 상품 공급방의 '어포튀김' 상품 찾기
  const eopoTuigim = posts.find(post =>
    post.title && post.title.includes('어포튀김') &&
    post.wholesaleBand.name.includes('나은')
  );

  if (eopoTuigim) {
    console.log('🎯 "어포튀김" 상품 발견:');
    console.log(`제목: ${eopoTuigim.title}`);
    console.log(`원가(extractedPrice): ${eopoTuigim.extractedPrice || 'N/A'}`);
    console.log(`조정가(adjustedPrice): ${eopoTuigim.adjustedPrice || 'N/A'}`);
    console.log(`정책적용여부: ${eopoTuigim.policyApplied}`);
    console.log(`배송비: ${eopoTuigim.shippingFee || 0}`);
    console.log(`도매방: ${eopoTuigim.wholesaleBand.name}`);

    // 나은 상품 공급방 정책에 따른 예상 가격 계산
    const supplyPrice = eopoTuigim.extractedPrice || 0;
    let expectedPrice = supplyPrice;
    if (supplyPrice > 0) {
      if (supplyPrice <= 19900) {
        expectedPrice = supplyPrice + 4000;
      } else {
        const excess = supplyPrice - 19900;
        const additionalSections = Math.ceil(excess / 10000);
        const additionalMargin = additionalSections * 1000;
        expectedPrice = supplyPrice + 4000 + additionalMargin;
      }
    }

    console.log(`예상 판매가(정책 적용시): ${expectedPrice}`);
    console.log(`현재 판매가와 차이: ${(eopoTuigim.adjustedPrice || 0) - expectedPrice}`);
    console.log('');
  }

  // 각 도매방별로 샘플 확인
  const bandSamples = {};
  posts.forEach(post => {
    const bandName = post.wholesaleBand.name;
    if (!bandSamples[bandName] && post.extractedPrice) {
      bandSamples[bandName] = post;
    }
  });

  console.log('📊 도매방별 가격 정보 샘플:');
  console.log('='.repeat(80));

  for (const [bandName, post] of Object.entries(bandSamples)) {
    console.log(`\n🏪 ${bandName}:`);
    console.log(`상품: ${post.title || 'N/A'}`);
    console.log(`원가: ${post.extractedPrice ? post.extractedPrice.toLocaleString() + '원' : 'N/A'}`);
    console.log(`판매가: ${post.adjustedPrice ? post.adjustedPrice.toLocaleString() + '원' : 'N/A'}`);
    console.log(`배송비: ${post.shippingFee || 0}원`);
    console.log(`정책적용: ${post.policyApplied ? 'O' : 'X'}`);

    if (post.adjustedPrice && post.extractedPrice) {
      const margin = post.adjustedPrice - post.extractedPrice;
      console.log(`마진: +${margin.toLocaleString()}원`);
    }
  }

  await prisma.$disconnect();
}

checkCurrentPricing().catch(console.error);