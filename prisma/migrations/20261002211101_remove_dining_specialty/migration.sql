/*
  Warnings:

  - You are about to drop the column `diningSpecialty` on the `Receipt` table. All the data in the column will be lost.
  - You are about to drop the column `diningSpecialty` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Receipt" DROP COLUMN "diningSpecialty";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "diningSpecialty";
