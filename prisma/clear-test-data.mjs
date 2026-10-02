import { PrismaClient } from "@prisma/client";
import { rm } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const receiptStorage = path.join(process.cwd(), "storage", "receipts");

try {
  const before = {
    receipts: await prisma.receipt.count(),
    receiptItems: await prisma.receiptItem.count(),
    transactions: await prisma.transaction.count(),
    classifications: await prisma.aiClassification.count(),
    rawImports: await prisma.rawImport.count(),
  };

  await prisma.$transaction(async (database) => {
    await database.receiptItem.deleteMany();
    await database.receipt.deleteMany();
    await database.aiClassification.deleteMany();
    await database.transaction.deleteMany();
    await database.rawImport.deleteMany();
  });

  await rm(receiptStorage, { recursive: true, force: true });

  console.log("Cleared test transactions and receipts:", before);
  console.log("Preserved accounts, Plaid/Gmail connections, categories, and budgets.");
} finally {
  await prisma.$disconnect();
}
