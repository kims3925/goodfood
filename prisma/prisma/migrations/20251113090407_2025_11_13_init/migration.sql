-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalPrice" REAL NOT NULL,
    "salePrice" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "productCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "images" TEXT NOT NULL DEFAULT '[]',
    "hookingTitle" TEXT,
    "hookingContent" TEXT,
    "detailedContent" TEXT,
    "productCategory" TEXT,
    "shippingFee" REAL,
    "priceInfo" TEXT,
    "specialNotes" TEXT,
    "hasDeadline" BOOLEAN NOT NULL DEFAULT false,
    "deadlineInfo" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "unavailableReason" TEXT,
    "wholesaleBandName" TEXT,
    "author" TEXT,
    "originalCreatedAt" DATETIME,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRegisteredToRetail" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "shippingAddress" TEXT,
    "customerMemo" TEXT,
    "trackingNumber" TEXT,
    "shippingStatus" TEXT NOT NULL DEFAULT 'PREPARING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourcingSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "url" TEXT,
    "customsBaseAmount" REAL,
    "shippingCost" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bandKey" TEXT,
    "bandAccessToken" TEXT,
    "apiKey" TEXT,
    "secretKey" TEXT,
    "sellerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourcingSite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WholesaleBand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bandKey" TEXT NOT NULL,
    "description" TEXT,
    "memberCount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "collectComments" BOOLEAN NOT NULL DEFAULT false,
    "pricingPolicy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WholesaleBand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectedPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wholesaleBandId" TEXT NOT NULL,
    "bandPostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT,
    "images" TEXT NOT NULL DEFAULT '[]',
    "comments" TEXT NOT NULL DEFAULT '[]',
    "policyApplied" BOOLEAN NOT NULL DEFAULT false,
    "priceCalculation" TEXT,
    "aiAnalyzed" BOOLEAN NOT NULL DEFAULT false,
    "shippingFee" REAL,
    "priceInfo" TEXT,
    "priceOptions" TEXT NOT NULL DEFAULT '[]',
    "shippingPolicy" TEXT,
    "hookingTitle" TEXT,
    "hookingContent" TEXT,
    "detailedContent" TEXT,
    "productCategory" TEXT NOT NULL DEFAULT 'OTHER',
    "extractedPrice" REAL,
    "adjustedPrice" REAL,
    "aiProcessedAt" DATETIME,
    "hasDeadline" BOOLEAN NOT NULL DEFAULT false,
    "deadlineInfo" TEXT,
    "lastCheckedAt" DATETIME,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "unavailableReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bandCreatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollectedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectedPost_wholesaleBandId_fkey" FOREIGN KEY ("wholesaleBandId") REFERENCES "WholesaleBand" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "paymentKey" TEXT,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "approvedAt" DATETIME,
    "failReason" TEXT,
    "cancelReason" TEXT,
    "webhookData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaDescription" TEXT,
    "customDomain" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "seoKeywords" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductPage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductPage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceAt" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "processedAt" DATETIME,
    "adminMemo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopName" TEXT NOT NULL DEFAULT 'BandAuto 쇼핑몰',
    "businessNumber" TEXT,
    "adminEmail" TEXT,
    "customerService" TEXT,
    "defaultShippingFee" REAL NOT NULL DEFAULT 3000,
    "freeShippingAmount" REAL NOT NULL DEFAULT 30000,
    "returnPolicy" TEXT,
    "privacyPolicy" TEXT,
    "termsOfService" TEXT,
    "bankAccount" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeliveryTracker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentLocation" TEXT,
    "lastUpdated" DATETIME,
    "history" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "shopUrl" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "noticeTitle" TEXT,
    "noticeContent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "supplyPrice" REAL NOT NULL,
    "salePrice" REAL NOT NULL,
    "shippingType" TEXT NOT NULL DEFAULT 'FREE',
    "shippingFee" REAL NOT NULL DEFAULT 0,
    "shippingUnit" INTEGER NOT NULL DEFAULT 1,
    "hasOptions" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT NOT NULL DEFAULT '[]',
    "thumbnail" TEXT,
    "detailContent" TEXT,
    "taxType" TEXT NOT NULL DEFAULT 'TAXABLE',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopProduct_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetailBand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bandKey" TEXT NOT NULL,
    "bandName" TEXT NOT NULL,
    "description" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetailBand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetailSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bandClientId" TEXT,
    "bandClientSecret" TEXT,
    "bandAccessToken" TEXT,
    "autoPostInterval" INTEGER NOT NULL DEFAULT 30,
    "maxPostsPerDay" INTEGER NOT NULL DEFAULT 20,
    "enableAutoPosting" BOOLEAN NOT NULL DEFAULT false,
    "postingStart" TEXT NOT NULL DEFAULT '09:00',
    "postingEnd" TEXT NOT NULL DEFAULT '22:00',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetailSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutomationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "defaultPricingPolicy" TEXT NOT NULL DEFAULT '수집가격 기준 구간별 마진 적용 (19,900원 이하 +1,000원, 20,000~29,900원 +2,000원, 30,000~39,900원 +3,000원, 40,000~49,900원 +4,000원, 50,000~59,900원 +5,000원, 60,001~70,000원 +6,000원, 70,001~80,000원 +7,000원, 80,001~90,000원 +8,000원, 90,001~100,000원 +9,000원, 100,001~150,000원 +12,000원, 150,001~200,000원 +20,000원, 200,001원 이상 +20,000원)',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AutomationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetailPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "retailBandId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bandPostId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT NOT NULL DEFAULT '[]',
    "price" REAL NOT NULL,
    "shippingFee" REAL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetailPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RetailPost_retailBandId_fkey" FOREIGN KEY ("retailBandId") REFERENCES "RetailBand" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RetailPost_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "aliexpress_sourcings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "searchType" TEXT NOT NULL,
    "searchValue" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pricingPolicy" TEXT,
    "collectReviews" BOOLEAN NOT NULL DEFAULT false,
    "minRating" REAL DEFAULT 4.0,
    "minOrders" INTEGER DEFAULT 100,
    "priceRange" TEXT NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCollectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "aliexpress_sourcings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "aliexpress_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourcingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "images" TEXT NOT NULL DEFAULT '[]',
    "reviews" TEXT NOT NULL DEFAULT '[]',
    "originalPrice" REAL NOT NULL,
    "discount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "minOrderQty" INTEGER,
    "shippingCost" REAL,
    "shippingDays" TEXT,
    "supplier" TEXT,
    "rating" REAL,
    "totalOrders" INTEGER,
    "aiAnalyzed" BOOLEAN NOT NULL DEFAULT false,
    "aiProcessedAt" DATETIME,
    "hookingTitle" TEXT,
    "hookingContent" TEXT,
    "detailedContent" TEXT,
    "extractedPrice" REAL,
    "adjustedPrice" REAL,
    "finalShippingFee" REAL,
    "priceOptions" TEXT NOT NULL DEFAULT '[]',
    "priceCalculation" TEXT,
    "productCategory" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "unavailableReason" TEXT,
    "lastCheckedAt" DATETIME,
    "policyApplied" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "aliexpress_products_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "aliexpress_products_sourcingId_fkey" FOREIGN KEY ("sourcingId") REFERENCES "aliexpress_sourcings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SUPPLIER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bandClientId" TEXT,
    "bandClientSecret" TEXT,
    "bandAccessToken" TEXT
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "password", "updatedAt") SELECT "createdAt", "email", "id", "name", "password", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Product_userId_idx" ON "Product"("userId");

-- CreateIndex
CREATE INDEX "Product_productCategory_idx" ON "Product"("productCategory");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_productId_idx" ON "Order"("productId");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_shippingStatus_idx" ON "Order"("shippingStatus");

-- CreateIndex
CREATE INDEX "SourcingSite_userId_idx" ON "SourcingSite"("userId");

-- CreateIndex
CREATE INDEX "SourcingSite_type_idx" ON "SourcingSite"("type");

-- CreateIndex
CREATE INDEX "WholesaleBand_userId_idx" ON "WholesaleBand"("userId");

-- CreateIndex
CREATE INDEX "WholesaleBand_bandKey_idx" ON "WholesaleBand"("bandKey");

-- CreateIndex
CREATE INDEX "CollectedPost_userId_idx" ON "CollectedPost"("userId");

-- CreateIndex
CREATE INDEX "CollectedPost_wholesaleBandId_idx" ON "CollectedPost"("wholesaleBandId");

-- CreateIndex
CREATE INDEX "CollectedPost_bandPostId_idx" ON "CollectedPost"("bandPostId");

-- CreateIndex
CREATE INDEX "CollectedPost_status_idx" ON "CollectedPost"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CollectedPost_wholesaleBandId_bandPostId_key" ON "CollectedPost"("wholesaleBandId", "bandPostId");

-- CreateIndex
CREATE INDEX "PaymentMethod_name_idx" ON "PaymentMethod"("name");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_paymentKey_idx" ON "Payment"("paymentKey");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPage_productId_key" ON "ProductPage"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPage_slug_key" ON "ProductPage"("slug");

-- CreateIndex
CREATE INDEX "ProductPage_slug_idx" ON "ProductPage"("slug");

-- CreateIndex
CREATE INDEX "ProductPage_userId_idx" ON "ProductPage"("userId");

-- CreateIndex
CREATE INDEX "ProductPage_isPublished_idx" ON "ProductPage"("isPublished");

-- CreateIndex
CREATE INDEX "Cart_sessionId_idx" ON "Cart"("sessionId");

-- CreateIndex
CREATE INDEX "Cart_userId_idx" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTracker_orderId_key" ON "DeliveryTracker"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryTracker_trackingNumber_idx" ON "DeliveryTracker"("trackingNumber");

-- CreateIndex
CREATE INDEX "DeliveryTracker_status_idx" ON "DeliveryTracker"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_userId_key" ON "Shop"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopUrl_key" ON "Shop"("shopUrl");

-- CreateIndex
CREATE INDEX "Shop_shopUrl_idx" ON "Shop"("shopUrl");

-- CreateIndex
CREATE INDEX "Shop_userId_idx" ON "Shop"("userId");

-- CreateIndex
CREATE INDEX "ShopProduct_shopId_idx" ON "ShopProduct"("shopId");

-- CreateIndex
CREATE INDEX "ShopProduct_status_idx" ON "ShopProduct"("status");

-- CreateIndex
CREATE INDEX "ShopProduct_isPublished_idx" ON "ShopProduct"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProduct_shopId_productCode_key" ON "ShopProduct"("shopId", "productCode");

-- CreateIndex
CREATE INDEX "RetailBand_userId_idx" ON "RetailBand"("userId");

-- CreateIndex
CREATE INDEX "RetailBand_bandKey_idx" ON "RetailBand"("bandKey");

-- CreateIndex
CREATE UNIQUE INDEX "RetailBand_userId_bandKey_key" ON "RetailBand"("userId", "bandKey");

-- CreateIndex
CREATE UNIQUE INDEX "RetailSettings_userId_key" ON "RetailSettings"("userId");

-- CreateIndex
CREATE INDEX "RetailSettings_userId_idx" ON "RetailSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationSettings_userId_key" ON "AutomationSettings"("userId");

-- CreateIndex
CREATE INDEX "AutomationSettings_userId_idx" ON "AutomationSettings"("userId");

-- CreateIndex
CREATE INDEX "RetailPost_userId_idx" ON "RetailPost"("userId");

-- CreateIndex
CREATE INDEX "RetailPost_retailBandId_idx" ON "RetailPost"("retailBandId");

-- CreateIndex
CREATE INDEX "RetailPost_productId_idx" ON "RetailPost"("productId");

-- CreateIndex
CREATE INDEX "RetailPost_status_idx" ON "RetailPost"("status");

-- CreateIndex
CREATE INDEX "RetailPost_publishedAt_idx" ON "RetailPost"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RetailPost_retailBandId_bandPostId_key" ON "RetailPost"("retailBandId", "bandPostId");

-- CreateIndex
CREATE INDEX "aliexpress_sourcings_userId_isActive_idx" ON "aliexpress_sourcings"("userId", "isActive");

-- CreateIndex
CREATE INDEX "aliexpress_sourcings_searchType_searchValue_idx" ON "aliexpress_sourcings"("searchType", "searchValue");

-- CreateIndex
CREATE INDEX "aliexpress_products_userId_sourcingId_status_idx" ON "aliexpress_products"("userId", "sourcingId", "status");

-- CreateIndex
CREATE INDEX "aliexpress_products_productId_idx" ON "aliexpress_products"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "aliexpress_products_sourcingId_productId_key" ON "aliexpress_products"("sourcingId", "productId");
