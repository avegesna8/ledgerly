import { mkdir, rename } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = "alex@ledgerly.local";
const storageRoot = path.resolve(process.cwd(), "storage", "receipts");
const backupRoot = path.join(
  "/tmp",
  `ledgerly-receipts-reset-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
let storageMoved = false;

try {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  try {
    await rename(storageRoot, backupRoot);
    storageMoved = true;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  await mkdir(storageRoot, { recursive: true });

  const removed = await prisma.$transaction(async (database) => {
    await database.investmentSecurity.deleteMany({ where: { userId: user.id } });
    const receipts = await database.receipt.deleteMany({
      where: { userId: user.id },
    });
    const transactions = await database.transaction.deleteMany({
      where: { userId: user.id },
    });
    const accounts = await database.financialAccount.deleteMany({
      where: { userId: user.id },
    });
    const integrations = await database.integrationConnection.deleteMany({
      where: { userId: user.id },
    });
    return {
      receipts: receipts.count,
      transactions: transactions.count,
      accounts: accounts.count,
      integrations: integrations.count,
    };
  });

  const preservedSources = await prisma.receiptSourceConnection.findMany({
    where: { userId: user.id },
    select: { provider: true, status: true },
    orderBy: { provider: "asc" },
  });
  const systemCategories = await prisma.category.count({
    where: { userId: user.id, isSystem: true },
  });
  const preservedCustomCategories = await prisma.category.count({
    where: { userId: user.id, isSystem: false },
  });
  console.log(
    JSON.stringify({
      removed,
      preserved: {
        user: email,
        receiptSources: preservedSources,
        systemCategories,
        customCategories: preservedCustomCategories,
        auditHistory: true,
        rawImports: true,
      },
      receiptFilesBackup: storageMoved ? backupRoot : null,
    }),
  );
} catch (error) {
  if (storageMoved) {
    try {
      await rename(backupRoot, storageRoot);
    } catch {
      // Report the original failure; the backup path is deterministic above.
    }
  }
  throw error;
} finally {
  await prisma.$disconnect();
}
