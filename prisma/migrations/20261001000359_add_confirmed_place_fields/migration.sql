-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "locationMapsUrl" TEXT,
ADD COLUMN     "locationPlaceId" TEXT,
ADD COLUMN     "locationSource" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "locationMapsUrl" TEXT,
ADD COLUMN     "locationPlaceId" TEXT;
