-- CreateTable
CREATE TABLE "AiClassification" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "suggestedCategoryId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiClassification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiClassification_transactionId_createdAt_idx" ON "AiClassification"("transactionId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiClassification" ADD CONSTRAINT "AiClassification_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiClassification" ADD CONSTRAINT "AiClassification_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
