const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAllPricing() {
  console.log('🔍 전체 도매방 가격정책 검증 시작...\n');

  // 모든 수집된 게시물 조회
  const posts = await prisma.collectedPost.findMany({
    include: {
      wholesaleBand: {
        select: { name: true, pricingPolicy: true }
      }
    },
    orderBy: { bandCreatedAt: 'desc' }
  });

  console.log(`총 ${posts.length}개의 수집된 게시물 발견\n`);

  // 가격정책 적용 함수 (confirm route와 동일)
  const applyPricingPolicy = (originalPrice, shippingFee = 0, policyText = '') => {
    if (!policyText) {
      return originalPrice;
    }

    let result = originalPrice;

    // 1. 가족도매방: 판매가는 원가 그대로
    if (policyText.includes('원가 그대로')) {
      result = originalPrice;
      return result;
    }

    // 2. 요한이네♧소매방 & 초록이네: 수집가격 기준 구간별 마진 적용
    if (policyText.includes('수집가격 기준 구간별 마진 적용')) {
      const basePrice = originalPrice;

      if (basePrice <= 19900) {
        result = basePrice + 1000;
      } else if (basePrice >= 20000 && basePrice <= 29900) {
        result = basePrice + 2000;
      } else if (basePrice >= 30000 && basePrice <= 39900) {
        result = basePrice + 3000;
      } else if (basePrice >= 40000 && basePrice <= 49900) {
        result = basePrice + 4000;
      } else if (basePrice >= 50000 && basePrice <= 59900) {
        result = basePrice + 5000;
      } else if (basePrice >= 60000) {
        result = basePrice + 6000;
      }

      return result;
    }

    // 3. 나은 상품 공급방, S D 푸드, 폐쇄몰VIP도매: 공급가에만 마진 적용, 배송비 별도
    if (policyText.includes('공급가와 배송비를 분리, 공급가에만 마진 적용')) {
      const supplyPrice = originalPrice;

      if (supplyPrice <= 19900) {
        result = supplyPrice + 4000; // 공급가 + 4,000원 마진
      } else {
        // 19,900원 초과시: 기본 4,000원 + 초과구간별(1만원마다) 1,000원
        const excess = supplyPrice - 19900;
        const additionalSections = Math.ceil(excess / 10000);
        const additionalMargin = additionalSections * 1000;
        result = supplyPrice + 4000 + additionalMargin;
      }

      return result; // 배송비는 별도 표시이므로 포함하지 않음
    }

    // 기본값: 원가 그대로
    return originalPrice;
  };

  // 가격 파싱 함수
  const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    if (typeof priceStr === 'number' && !isNaN(priceStr)) return Math.floor(priceStr);

    // 문자열 처리
    let cleanStr = String(priceStr);

    // 먼저 "원" 앞의 숫자만 추출 (콤마 포함)
    const priceMatch = cleanStr.match(/([0-9,]+)원/);
    if (priceMatch) {
      const priceOnly = priceMatch[1].replace(/,/g, '');
      const parsed = parseInt(priceOnly);
      return !isNaN(parsed) && parsed > 0 ? parsed : 0;
    }

    // "원"이 없는 경우 첫 번째 연속된 숫자 그룹만 추출
    const numberMatch = cleanStr.match(/^[0-9,]+/);
    if (numberMatch) {
      const cleanPrice = numberMatch[0].replace(/,/g, '');
      const parsed = parseInt(cleanPrice);
      return !isNaN(parsed) && parsed > 0 ? parsed : 0;
    }

    // 최후의 수단: 모든 숫자 추출 후 앞 6자리까지만
    const allNumbers = cleanStr.replace(/[^0-9]/g, '');
    if (allNumbers) {
      const limitedNumbers = allNumbers.substring(0, 6);
      const parsed = parseInt(limitedNumbers);
      return !isNaN(parsed) && parsed > 0 ? parsed : 0;
    }

    return 0;
  };

  // 도매방별 분석
  const bandAnalysis = {};
  const incorrectPricing = [];

  posts.forEach(post => {
    const bandName = post.wholesaleBand.name;
    const policyText = post.wholesaleBand.pricingPolicy || '';

    if (!bandAnalysis[bandName]) {
      bandAnalysis[bandName] = {
        policy: policyText,
        totalPosts: 0,
        correctPricing: 0,
        incorrectPricing: 0,
        samples: []
      };
    }

    bandAnalysis[bandName].totalPosts++;

    // 현재 가격 추출
    let currentSupplyPrice = 0;
    let currentSalePrice = 0;

    if (post.extractedPrice) {
      currentSupplyPrice = post.extractedPrice;
    } else if (post.priceOptions) {
      try {
        const priceOptions = JSON.parse(post.priceOptions);
        if (priceOptions.length > 0) {
          currentSupplyPrice = parsePrice(priceOptions[0].price);
        }
      } catch (e) {
        // 파싱 실패시 priceCalculation에서 추출 시도
        if (post.priceCalculation) {
          const priceMatch = post.priceCalculation.match(/(\d+,?\d*)\s*원/);
          if (priceMatch) {
            currentSupplyPrice = parsePrice(priceMatch[1]);
          }
        }
      }
    }

    if (post.adjustedPrice) {
      currentSalePrice = post.adjustedPrice;
    }

    // 정책에 따른 예상 판매가 계산
    const expectedSalePrice = applyPricingPolicy(
      currentSupplyPrice,
      post.shippingFee || 0,
      policyText
    );

    // 가격 일치 여부 확인 (±100원 허용)
    const priceDifference = Math.abs(currentSalePrice - expectedSalePrice);
    const isCorrect = priceDifference <= 100;

    if (isCorrect) {
      bandAnalysis[bandName].correctPricing++;
    } else {
      bandAnalysis[bandName].incorrectPricing++;

      incorrectPricing.push({
        id: post.id,
        bandName,
        title: post.title,
        supplyPrice: currentSupplyPrice,
        currentSalePrice,
        expectedSalePrice,
        difference: currentSalePrice - expectedSalePrice,
        shippingFee: post.shippingFee || 0
      });
    }

    // 샘플 데이터 수집 (첫 3개만)
    if (bandAnalysis[bandName].samples.length < 3 && currentSupplyPrice > 0) {
      bandAnalysis[bandName].samples.push({
        title: post.title,
        supplyPrice: currentSupplyPrice,
        currentSalePrice,
        expectedSalePrice,
        isCorrect,
        difference: currentSalePrice - expectedSalePrice
      });
    }
  });

  // 결과 출력
  console.log('📊 도매방별 가격정책 검증 결과:');
  console.log('='.repeat(100));

  for (const [bandName, analysis] of Object.entries(bandAnalysis)) {
    const accuracy = analysis.totalPosts > 0
      ? ((analysis.correctPricing / analysis.totalPosts) * 100).toFixed(1)
      : '0.0';

    console.log(`\n🏪 ${bandName}:`);
    console.log(`정책: ${analysis.policy.substring(0, 50)}${analysis.policy.length > 50 ? '...' : ''}`);
    console.log(`총 게시물: ${analysis.totalPosts}개`);
    console.log(`정확한 가격: ${analysis.correctPricing}개 (${accuracy}%)`);
    console.log(`잘못된 가격: ${analysis.incorrectPricing}개`);

    if (analysis.samples.length > 0) {
      console.log(`\n📋 샘플 확인:`);
      analysis.samples.forEach((sample, idx) => {
        const status = sample.isCorrect ? '✅' : '❌';
        console.log(`  ${idx + 1}. ${status} ${sample.title || 'N/A'}`);
        console.log(`     공급가: ${sample.supplyPrice.toLocaleString()}원`);
        console.log(`     현재 판매가: ${sample.currentSalePrice.toLocaleString()}원`);
        console.log(`     예상 판매가: ${sample.expectedSalePrice.toLocaleString()}원`);
        if (!sample.isCorrect) {
          console.log(`     차이: ${sample.difference > 0 ? '+' : ''}${sample.difference.toLocaleString()}원`);
        }
      });
    }
  }

  // 잘못된 가격 목록 출력
  if (incorrectPricing.length > 0) {
    console.log(`\n\n❌ 가격 수정이 필요한 ${incorrectPricing.length}개 상품:`);
    console.log('='.repeat(100));

    incorrectPricing.slice(0, 20).forEach((item, idx) => {
      console.log(`\n${idx + 1}. [${item.bandName}] ${item.title || 'N/A'}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   공급가: ${item.supplyPrice.toLocaleString()}원`);
      console.log(`   현재 판매가: ${item.currentSalePrice.toLocaleString()}원`);
      console.log(`   정책 적용시: ${item.expectedSalePrice.toLocaleString()}원`);
      console.log(`   차이: ${item.difference > 0 ? '+' : ''}${item.difference.toLocaleString()}원`);
      if (item.shippingFee > 0) {
        console.log(`   배송비: ${item.shippingFee.toLocaleString()}원`);
      }
    });

    if (incorrectPricing.length > 20) {
      console.log(`\n... 외 ${incorrectPricing.length - 20}개 더 있음`);
    }
  }

  // 요약 통계
  const totalPosts = posts.length;
  const totalIncorrect = incorrectPricing.length;
  const accuracy = totalPosts > 0 ? (((totalPosts - totalIncorrect) / totalPosts) * 100).toFixed(1) : '0.0';

  console.log(`\n\n📈 전체 요약:`);
  console.log(`총 게시물: ${totalPosts}개`);
  console.log(`정확한 가격: ${totalPosts - totalIncorrect}개 (${accuracy}%)`);
  console.log(`수정 필요: ${totalIncorrect}개`);

  await prisma.$disconnect();

  return {
    totalPosts,
    incorrectPricing,
    bandAnalysis,
    summary: {
      accuracy: parseFloat(accuracy),
      needsCorrection: totalIncorrect
    }
  };
}

verifyAllPricing().catch(console.error);