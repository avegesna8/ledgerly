import { unlink } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const storageRoot = path.resolve(process.cwd(), "storage", "receipts");

try {
  const receipts = await prisma.receipt.findMany({
    where: { source: "GMAIL" },
    select: { id: true, storageKey: true },
  });

  await prisma.receipt.deleteMany({
    where: { id: { in: receipts.map((receipt) => receipt.id) } },
  });

  let filesRemoved = 0;
  for (const receipt of receipts) {
    const target = path.resolve(storageRoot, receipt.storageKey);
    if (!target.startsWith(`${storageRoot}${path.sep}`)) continue;
    try {
      await unlink(target);
      filesRemoved++;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT"))
        throw error;
    }
  }

  console.log(
    JSON.stringify({
      gmailReceiptsRemoved: receipts.length,
      filesRemoved,
      connectionPreserved: true,
    }),
  );
} finally {
  await prisma.$disconnect();
}
