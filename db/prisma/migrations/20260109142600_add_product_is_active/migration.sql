-- AlterTable: product 테이블에 is_active 컬럼 추가
-- 쇼핑몰에서 상품 노출 여부를 제어하는 필드
-- 기본값 true: 기존 상품은 모두 활성화 상태로 유지

ALTER TABLE `product` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;
