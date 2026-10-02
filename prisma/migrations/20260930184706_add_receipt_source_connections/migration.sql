-- CreateTable
CREATE TABLE "ReceiptSourceConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "displayName" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "scopes" TEXT[],
    "tokenExpiresAt" TIMESTAMP(3),
    "cursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptSourceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptSourceConnection_userId_provider_idx" ON "ReceiptSourceConnection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptSourceConnection_provider_externalAccountId_key" ON "ReceiptSourceConnection"("provider", "externalAccountId");

-- AddForeignKey
ALTER TABLE "ReceiptSourceConnection" ADD CONSTRAINT "ReceiptSourceConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
