import { PrismaClient } from "@prisma/client";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const storageRoot = path.resolve(process.cwd(), "storage", "receipts");
const backupRoot = path.join(
  "/tmp",
  `ledgerly-drive-receipts-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);

try {
  const receipts = await prisma.receipt.findMany({
    where: { source: "GOOGLE_DRIVE" },
    select: { id: true, storageKey: true },
  });

  let backedUp = 0;
  for (const receipt of receipts) {
    const target = path.resolve(storageRoot, receipt.storageKey);
    if (target.startsWith(`${storageRoot}${path.sep}`)) {
      const backup = path.join(backupRoot, receipt.storageKey);
      await mkdir(path.dirname(backup), { recursive: true });
      try {
        await rename(target, backup);
        backedUp++;
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
      }
    }
  }

  await prisma.receipt.deleteMany({
    where: { id: { in: receipts.map((receipt) => receipt.id) } },
  });

  console.log(`Cleared ${receipts.length} Google Drive receipt${receipts.length === 1 ? "" : "s"}.`);
  console.log("Preserved the Drive connection, selected folder, transactions, and other receipt sources.");
  if (backedUp) console.log(`Backed up ${backedUp} cached file${backedUp === 1 ? "" : "s"} to ${backupRoot}.`);
} finally {
  await prisma.$disconnect();
}
