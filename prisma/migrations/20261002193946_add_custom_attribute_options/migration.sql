-- CreateTable
CREATE TABLE "CustomAttributeOption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomAttributeOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomAttributeOption_userId_scope_attribute_isActive_idx" ON "CustomAttributeOption"("userId", "scope", "attribute", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CustomAttributeOption_userId_scope_attribute_normalizedLabe_key" ON "CustomAttributeOption"("userId", "scope", "attribute", "normalizedLabel");

-- AddForeignKey
ALTER TABLE "CustomAttributeOption" ADD CONSTRAINT "CustomAttributeOption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
