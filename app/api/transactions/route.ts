import type { TransactionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diningValue } from "@/lib/dining-attributes";
import { isTrackedTransactionDate } from "@/lib/tracking";

const transactionTypes = new Set([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "REFUND",
  "REIMBURSEMENT",
  "ADJUSTMENT",
]);
const outgoing = new Set(["EXPENSE", "TRANSFER"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const merchant =
    typeof body?.merchant === "string" ? body.merchant.trim() : "";
  const accountId = String(body?.accountId ?? "");
  const categoryId = String(body?.categoryId ?? "");
  const rawType = String(body?.type ?? "EXPENSE");
  const absoluteAmount = Math.abs(Number(body?.amount));
  const transactedAt = new Date(String(body?.date ?? ""));
  const paymentChannel = ["IN_STORE", "ONLINE", "DELIVERY", "UNKNOWN"].includes(
    String(body?.paymentChannel),
  )
    ? String(body.paymentChannel)
    : "UNKNOWN";
  const diningCuisine = diningValue(body?.diningCuisine, "cuisine");
  const diningVenueType = diningValue(body?.diningVenueType, "venueType");
  const diningServiceStyle = diningValue(
    body?.diningServiceStyle,
    "serviceStyle",
  );
  if (
    !merchant ||
    !accountId ||
    !categoryId ||
    !transactionTypes.has(rawType) ||
    !Number.isFinite(absoluteAmount) ||
    absoluteAmount <= 0 ||
    Number.isNaN(transactedAt.getTime())
  ) {
    return NextResponse.json(
      { error: "Enter valid transaction details." },
      { status: 400 },
    );
  }
  const type = rawType as TransactionType;
  const amount = outgoing.has(type) ? -absoluteAmount : absoluteAmount;
  const [account, category] = await Promise.all([
    prisma.financialAccount.findUnique({ where: { id: accountId } }),
    prisma.category.findUnique({ where: { id: categoryId } }),
  ]);
  if (!account || !category || account.userId !== category.userId)
    return NextResponse.json(
      { error: "Account or category not found." },
      { status: 404 },
    );
  const user = await prisma.user.findUnique({ where:{ id:account.userId }, select:{ trackingStartedAt:true } });
  if (!isTrackedTransactionDate(transactedAt.toISOString().slice(0,10), user?.trackingStartedAt)) {
    return NextResponse.json({ error:"This date is before your Ledgerly tracking start date." }, { status:400 });
  }

  const result = await prisma.$transaction(async (database) => {
    const transaction = await database.transaction.create({
      data: {
        userId: account.userId,
        sourceAccountId: accountId,
        transactedAt,
        postedAt: transactedAt,
        merchantRaw: merchant,
        merchantNormalized: merchant,
        amount,
        type,
        status: "NEEDS_REVIEW",
        categoryId,
        paymentChannel,
        diningCuisine,
        diningVenueType,
        diningServiceStyle,
      },
    });
    const nextBalance = Number(account.currentBalance) + amount;
    await database.financialAccount.update({
      where: { id: accountId },
      data: {
        currentBalance: nextBalance,
        availableBalance: nextBalance,
        lastSyncedAt: new Date(),
      },
    });
    await database.accountBalanceSnapshot.create({
      data: {
        accountId,
        balance: nextBalance,
        availableBalance: nextBalance,
        source: "manual_transaction",
      },
    });
    await database.auditLog.create({
      data: {
        entityType: "Transaction",
        entityId: transaction.id,
        action: "CREATE",
        actorType: "USER",
        after: { merchant, amount, type, accountId, categoryId },
      },
    });
    return transaction;
  });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
