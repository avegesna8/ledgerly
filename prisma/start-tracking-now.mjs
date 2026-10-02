import { mkdir, rename, rmdir } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = "alex@ledgerly.local";
const requestedStart = process.env.TRACKING_START_AT
  ? new Date(process.env.TRACKING_START_AT)
  : new Date();

if (Number.isNaN(requestedStart.getTime())) throw new Error("TRACKING_START_AT must be a valid ISO date/time.");

let backupPath = null;
try {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const receiptDirectory = path.resolve(process.cwd(), "storage", "receipts", user.id);
  backupPath = path.join("/tmp", `ledgerly-pre-tracking-receipts-${requestedStart.toISOString().replace(/[:.]/g, "-")}`);
  try {
    await rename(receiptDirectory, backupPath);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    backupPath = null;
  }
  await mkdir(receiptDirectory, { recursive: true });

  const removed = await prisma.$transaction(async (database) => {
    const removedReceipts = await database.receipt.deleteMany({ where: { userId: user.id } });
    const removedTransactions = await database.transaction.deleteMany({ where: { userId: user.id } });
    await database.integrationConnection.updateMany({
      where: { userId: user.id, provider: "PLAID" },
      data: { syncCursor: null },
    });
    await database.receiptSourceConnection.updateMany({
      where: { userId: user.id },
      data: { lastSyncedAt: null },
    });
    await database.user.update({
      where: { id: user.id },
      data: { trackingStartedAt: requestedStart },
    });
    return { receipts: removedReceipts.count, transactions: removedTransactions.count };
  });

  console.log(JSON.stringify({ trackingStartedAt: requestedStart.toISOString(), removed, receiptFilesBackup: backupPath }, null, 2));
} catch (error) {
  if (backupPath) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const receiptDirectory = path.resolve(process.cwd(), "storage", "receipts", user.id);
      try { await rmdir(receiptDirectory); } catch {}
      try { await rename(backupPath, receiptDirectory); } catch {}
    }
  }
  throw error;
} finally {
  await prisma.$disconnect();
}
