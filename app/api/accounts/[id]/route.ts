import type { AccountType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const accountTypes = new Set(["CHECKING", "SAVINGS", "INVESTMENT", "WALLET", "CASH", "STORED_CREDIT", "LIABILITY", "OTHER"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.provider !== "string") {
    return NextResponse.json({ error: "Name and provider are required." }, { status: 400 });
  }

  const name = body.name.trim();
  const provider = body.provider.trim();
  const balance = Number(body.balance);
  const rawType = String(body.type ?? "OTHER");
  if (!name || !provider || !Number.isFinite(balance) || !accountTypes.has(rawType)) {
    return NextResponse.json({ error: "Enter valid account details." }, { status: 400 });
  }
  const type = rawType as AccountType;

  const existing = await prisma.financialAccount.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const previousBalance = Number(existing.currentBalance);
  const balanceChanged = previousBalance !== balance;
  const updated = await prisma.$transaction(async (database) => {
    const account = await database.financialAccount.update({
      where: { id },
      data: {
        name,
        provider,
        type,
        currentBalance: balance,
        availableBalance: balance,
        withdrawable: type !== "STORED_CREDIT",
        includeInNetWorth: type !== "STORED_CREDIT",
        lastSyncedAt: new Date(),
      },
    });
    if (balanceChanged) {
      await database.accountBalanceSnapshot.create({
        data: { accountId: id, balance, availableBalance: balance, source: "manual" },
      });
    }
    await database.auditLog.create({
      data: {
        entityType: "FinancialAccount",
        entityId: id,
        action: "UPDATE",
        actorType: "USER",
        before: { name: existing.name, provider: existing.provider, type: existing.type, balance: previousBalance },
        after: { name, provider, type, balance },
      },
    });
    return account;
  });

  return NextResponse.json({ id: updated.id, balanceSnapshotCreated: balanceChanged });
}
