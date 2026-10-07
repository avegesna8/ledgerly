-- Preserve one end-of-sync value for every investment holding each day.
CREATE TABLE "InvestmentHoldingSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "quantity" DECIMAL(28,10) NOT NULL,
    "institutionPrice" DECIMAL(24,8),
    "institutionValue" DECIMAL(18,2) NOT NULL,
    "costBasis" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "recordedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentHoldingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestmentHoldingSnapshot_accountId_securityId_recordedOn_key"
ON "InvestmentHoldingSnapshot"("accountId", "securityId", "recordedOn");

CREATE INDEX "InvestmentHoldingSnapshot_accountId_recordedOn_idx"
ON "InvestmentHoldingSnapshot"("accountId", "recordedOn");

ALTER TABLE "InvestmentHoldingSnapshot"
ADD CONSTRAINT "InvestmentHoldingSnapshot_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestmentHoldingSnapshot"
ADD CONSTRAINT "InvestmentHoldingSnapshot_securityId_fkey"
FOREIGN KEY ("securityId") REFERENCES "InvestmentSecurity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
