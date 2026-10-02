import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? [
        ...new Set<string>(
          body.ids.filter(
            (id: unknown): id is string => typeof id === "string",
          ),
        ),
      ]
    : [];
  if (body?.action !== "dismiss" || !ids.length)
    return NextResponse.json(
      { error: "Choose at least one receipt to dismiss." },
      { status: 400 },
    );

  const user = await prisma.user.findUnique({
    where: { email: "alex@ledgerly.local" },
  });
  if (!user)
    return NextResponse.json(
      { error: "Local user not found." },
      { status: 404 },
    );

  const receipts = await prisma.receipt.findMany({
    where: {
      id: { in: ids },
      userId: user.id,
      status: { notIn: ["CONFIRMED", "REJECTED"] },
    },
    select: { id: true, status: true, transactionId: true },
  });
  if (!receipts.length)
    return NextResponse.json({ dismissed: 0, skipped: ids.length });

  await prisma.$transaction(async (database) => {
    await database.receipt.updateMany({
      where: { id: { in: receipts.map((receipt) => receipt.id) } },
      data: {
        status: "REJECTED",
        transactionId: null,
        matchConfidence: null,
      },
    });
    await database.auditLog.createMany({
      data: receipts.map((receipt) => ({
        entityType: "Receipt",
        entityId: receipt.id,
        action: "DISMISSED",
        actorType: "USER",
        before: {
          status: receipt.status,
          transactionId: receipt.transactionId,
        },
        after: { status: "REJECTED" },
      })),
    });
  });

  return NextResponse.json({
    dismissed: receipts.length,
    skipped: ids.length - receipts.length,
  });
}
