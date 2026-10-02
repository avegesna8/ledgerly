import type { TransactionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diningValue } from "@/lib/dining-attributes";

const transactionTypes = new Set([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "REFUND",
  "REIMBURSEMENT",
  "ADJUSTMENT",
]);
const outgoing = new Set(["EXPENSE", "TRANSFER"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
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
  )
    return NextResponse.json(
      { error: "Enter valid transaction details." },
      { status: 400 },
    );
  const type = rawType as TransactionType;
  const amount = outgoing.has(type) ? -absoluteAmount : absoluteAmount;
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { sourceAccount: true },
  });
  const newAccount = await prisma.financialAccount.findUnique({
    where: { id: accountId },
  });
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (
    !existing ||
    !newAccount ||
    !category ||
    existing.userId !== newAccount.userId ||
    existing.userId !== category.userId
  )
    return NextResponse.json(
      { error: "Transaction, account, or category not found." },
      { status: 404 },
    );

  await prisma.$transaction(async (database) => {
    const oldAmount = Number(existing.amount);
    if (existing.sourceAccountId === accountId) {
      const nextBalance =
        Number(existing.sourceAccount.currentBalance) - oldAmount + amount;
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
          source: "transaction_edit",
        },
      });
    } else {
      const restoredBalance =
        Number(existing.sourceAccount.currentBalance) - oldAmount;
      const nextBalance = Number(newAccount.currentBalance) + amount;
      await database.financialAccount.update({
        where: { id: existing.sourceAccountId },
        data: {
          currentBalance: restoredBalance,
          availableBalance: restoredBalance,
          lastSyncedAt: new Date(),
        },
      });
      await database.accountBalanceSnapshot.create({
        data: {
          accountId: existing.sourceAccountId,
          balance: restoredBalance,
          availableBalance: restoredBalance,
          source: "transaction_move",
        },
      });
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
          source: "transaction_move",
        },
      });
    }
    await database.transaction.update({
      where: { id },
      data: {
        sourceAccountId: accountId,
        categoryId,
        merchantRaw: merchant,
        merchantNormalized: merchant,
        amount,
        type,
        transactedAt,
        postedAt: transactedAt,
        status: "CONFIRMED",
        paymentChannel,
        diningCuisine,
        diningVenueType,
        diningServiceStyle,
      },
    });
    await database.auditLog.create({
      data: {
        entityType: "Transaction",
        entityId: id,
        action: "UPDATE",
        actorType: "USER",
        before: {
          merchant: existing.merchantNormalized ?? existing.merchantRaw,
          amount: oldAmount,
          type: existing.type,
          accountId: existing.sourceAccountId,
          categoryId: existing.categoryId,
        },
        after: { merchant, amount, type, accountId, categoryId },
      },
    });
  });
  return NextResponse.json({ id });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { sourceAccount: true },
  });
  if (!existing)
    return NextResponse.json(
      { error: "Transaction not found." },
      { status: 404 },
    );

  await prisma.$transaction(async (database) => {
    const restoredBalance =
      Number(existing.sourceAccount.currentBalance) - Number(existing.amount);
    await database.financialAccount.update({
      where: { id: existing.sourceAccountId },
      data: {
        currentBalance: restoredBalance,
        availableBalance: restoredBalance,
        lastSyncedAt: new Date(),
      },
    });
    await database.accountBalanceSnapshot.create({
      data: {
        accountId: existing.sourceAccountId,
        balance: restoredBalance,
        availableBalance: restoredBalance,
        source: "transaction_delete",
      },
    });
    await database.auditLog.create({
      data: {
        entityType: "Transaction",
        entityId: id,
        action: "DELETE",
        actorType: "USER",
        before: {
          merchant: existing.merchantNormalized ?? existing.merchantRaw,
          amount: Number(existing.amount),
          type: existing.type,
          accountId: existing.sourceAccountId,
          categoryId: existing.categoryId,
        },
      },
    });
    await database.transaction.delete({ where: { id } });
  });

  return NextResponse.json({ id, deleted: true });
}
