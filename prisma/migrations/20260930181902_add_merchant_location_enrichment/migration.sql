-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "locationAddress" TEXT,
ADD COLUMN     "locationCity" TEXT,
ADD COLUMN     "locationCountry" TEXT,
ADD COLUMN     "locationLatitude" DOUBLE PRECISION,
ADD COLUMN     "locationLongitude" DOUBLE PRECISION,
ADD COLUMN     "locationPostalCode" TEXT,
ADD COLUMN     "locationRegion" TEXT,
ADD COLUMN     "merchantId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "authorizedAt" TIMESTAMP(3),
ADD COLUMN     "locationAddress" TEXT,
ADD COLUMN     "locationCity" TEXT,
ADD COLUMN     "locationCountry" TEXT,
ADD COLUMN     "locationLatitude" DOUBLE PRECISION,
ADD COLUMN     "locationLongitude" DOUBLE PRECISION,
ADD COLUMN     "locationPostalCode" TEXT,
ADD COLUMN     "locationRegion" TEXT,
ADD COLUMN     "locationSource" TEXT,
ADD COLUMN     "locationStoreNumber" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "merchantId" TEXT,
ADD COLUMN     "paymentChannel" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plaidMerchantEntityId" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Merchant_userId_name_idx" ON "Merchant"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_userId_plaidMerchantEntityId_key" ON "Merchant"("userId", "plaidMerchantEntityId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
