const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllPricing() {
  console.log('🔧 전체 가격정책 일괄 수정 시작...\n');

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

  // 모든 수집된 게시물 조회
  const posts = await prisma.collectedPost.findMany({
    include: {
      wholesaleBand: {
        select: { name: true, pricingPolicy: true }
      }
    }
  });

  console.log(`처리할 게시물: ${posts.length}개\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // 배치별로 처리 (한 번에 100개씩)
  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(posts.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, posts.length);
    const batch = posts.slice(startIndex, endIndex);

    console.log(`\n🔄 배치 ${batchIndex + 1}/${totalBatches} 처리 중... (${startIndex + 1}-${endIndex})`);

    const updatePromises = batch.map(async (post) => {
      try {
        const policyText = post.wholesaleBand.pricingPolicy || '';

        // 현재 공급가 추출
        let currentSupplyPrice = 0;

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

        if (currentSupplyPrice <= 0) {
          skippedCount++;
          return null; // 가격을 추출할 수 없으면 스킵
        }

        // 정책에 따른 새로운 판매가 계산
        const newSalePrice = applyPricingPolicy(
          currentSupplyPrice,
          post.shippingFee || 0,
          policyText
        );

        // 현재 판매가와 비교하여 차이가 있을 때만 업데이트
        const currentSalePrice = post.adjustedPrice || 0;
        const priceDifference = Math.abs(currentSalePrice - newSalePrice);

        if (priceDifference > 100) { // 100원 이상 차이가 날 때만 업데이트
          await prisma.collectedPost.update({
            where: { id: post.id },
            data: {
              adjustedPrice: newSalePrice,
              policyApplied: true,
              extractedPrice: currentSupplyPrice // extractedPrice도 명확히 설정
            }
          });

          updatedCount++;
          return {
            id: post.id,
            title: post.title?.substring(0, 50) + '...',
            bandName: post.wholesaleBand.name,
            oldPrice: currentSalePrice,
            newPrice: newSalePrice,
            difference: newSalePrice - currentSalePrice
          };
        } else {
          // 가격 차이가 크지 않지만 policyApplied가 false인 경우 true로 설정
          if (!post.policyApplied) {
            await prisma.collectedPost.update({
              where: { id: post.id },
              data: {
                policyApplied: true,
                extractedPrice: currentSupplyPrice
              }
            });
          }
          skippedCount++;
          return null;
        }

      } catch (error) {
        console.error(`게시물 ${post.id} 처리 중 오류:`, error.message);
        errorCount++;
        return null;
      }
    });

    // 배치 내 모든 업데이트 완료 대기
    const results = await Promise.all(updatePromises);

    // 업데이트된 항목들 출력
    const updates = results.filter(r => r !== null);
    if (updates.length > 0) {
      console.log(`✅ ${updates.length}개 항목 업데이트 완료:`);
      updates.slice(0, 5).forEach(update => {
        console.log(`  • [${update.bandName}] ${update.title}`);
        console.log(`    ${update.oldPrice.toLocaleString()}원 → ${update.newPrice.toLocaleString()}원 (${update.difference > 0 ? '+' : ''}${update.difference.toLocaleString()}원)`);
      });
      if (updates.length > 5) {
        console.log(`    ... 외 ${updates.length - 5}개 더`);
      }
    }

    // 진행률 표시
    const progress = ((batchIndex + 1) / totalBatches * 100).toFixed(1);
    console.log(`📊 진행률: ${progress}% (${endIndex}/${posts.length})`);
  }

  console.log('\n🎉 가격정책 일괄 수정 완료!');
  console.log('='.repeat(60));
  console.log(`총 처리 대상: ${posts.length}개`);
  console.log(`업데이트됨: ${updatedCount}개`);
  console.log(`스킵됨: ${skippedCount}개`);
  console.log(`오류 발생: ${errorCount}개`);

  if (updatedCount > 0) {
    console.log(`\n✨ ${updatedCount}개 상품의 가격이 올바른 정책으로 수정되었습니다!`);
  }

  await prisma.$disconnect();
  return {
    processed: posts.length,
    updated: updatedCount,
    skipped: skippedCount,
    errors: errorCount
  };
}

// 실행
fixAllPricing().catch(console.error);