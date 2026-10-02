ALTER TABLE "Receipt"
ADD COLUMN "userId" TEXT NOT NULL,
ADD COLUMN "storageKey" TEXT NOT NULL,
ADD COLUMN "originalFilename" TEXT NOT NULL,
ADD COLUMN "mimeType" TEXT NOT NULL,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN "sourceExternalId" TEXT,
ADD COLUMN "checksum" TEXT NOT NULL,
ADD COLUMN "matchConfidence" DOUBLE PRECISION,
ADD COLUMN "extractedData" JSONB,
ADD COLUMN "analysisConsentAt" TIMESTAMP(3);

ALTER TABLE "Receipt"
ADD CONSTRAINT "Receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Receipt_userId_checksum_key" ON "Receipt"("userId", "checksum");
CREATE UNIQUE INDEX "Receipt_source_sourceExternalId_key" ON "Receipt"("source", "sourceExternalId");
CREATE INDEX "Receipt_userId_status_createdAt_idx" ON "Receipt"("userId", "status", "createdAt");
