-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "diningCuisine" TEXT,
ADD COLUMN     "diningServiceStyle" TEXT,
ADD COLUMN     "diningSpecialty" TEXT,
ADD COLUMN     "diningVenueType" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "diningCuisine" TEXT,
ADD COLUMN     "diningServiceStyle" TEXT,
ADD COLUMN     "diningSpecialty" TEXT,
ADD COLUMN     "diningVenueType" TEXT;
