-- AlterTable
ALTER TABLE "FinancialAccount" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mask" TEXT,
ADD COLUMN     "subtype" TEXT;

-- AlterTable
ALTER TABLE "IntegrationConnection" ADD COLUMN     "consentExpiresAt" TIMESTAMP(3),
ADD COLUMN     "needsAttention" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "newAccountsAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "products" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "InvestmentSecurity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plaidSecurityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tickerSymbol" TEXT,
    "type" TEXT,
    "closePrice" DECIMAL(24,8),
    "closePriceAsOf" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentSecurity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentHolding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "quantity" DECIMAL(28,10) NOT NULL,
    "institutionPrice" DECIMAL(24,8),
    "institutionValue" DECIMAL(18,2) NOT NULL,
    "costBasis" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT,
    "providerTransactionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(28,10),
    "price" DECIMAL(24,8),
    "fees" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestmentSecurity_userId_type_idx" ON "InvestmentSecurity"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentSecurity_userId_plaidSecurityId_key" ON "InvestmentSecurity"("userId", "plaidSecurityId");

-- CreateIndex
CREATE INDEX "InvestmentHolding_accountId_institutionValue_idx" ON "InvestmentHolding"("accountId", "institutionValue");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentHolding_accountId_securityId_key" ON "InvestmentHolding"("accountId", "securityId");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_accountId_date_idx" ON "InvestmentTransaction"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentTransaction_accountId_providerTransactionId_key" ON "InvestmentTransaction"("accountId", "providerTransactionId");

-- AddForeignKey
ALTER TABLE "InvestmentSecurity" ADD CONSTRAINT "InvestmentSecurity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentHolding" ADD CONSTRAINT "InvestmentHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentHolding" ADD CONSTRAINT "InvestmentHolding_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "InvestmentSecurity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "InvestmentSecurity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
