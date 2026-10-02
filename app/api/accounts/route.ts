import { NextResponse } from "next/server";
import type { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const accountTypes = new Set(["CHECKING", "SAVINGS", "INVESTMENT", "WALLET", "CASH", "STORED_CREDIT", "LIABILITY", "OTHER"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.provider !== "string") return NextResponse.json({ error: "Name and provider are required." }, { status: 400 });
  const name = body.name.trim();
  const provider = body.provider.trim();
  const balance = Number(body.balance);
  const rawType = String(body.type ?? "OTHER");
  if (!name || !provider || !Number.isFinite(balance) || !accountTypes.has(rawType)) return NextResponse.json({ error: "Enter valid account details." }, { status: 400 });
  const type = rawType as AccountType;
  const user = await prisma.user.findUnique({ where: { email: "alex@ledgerly.local" } });
  if (!user) return NextResponse.json({ error: "Local user not found. Run the seed command first." }, { status: 404 });
  const account = await prisma.$transaction(async (database) => {
    const created = await database.financialAccount.create({ data: { userId:user.id, name, provider, type, currentBalance:balance, availableBalance:balance, withdrawable:type !== "STORED_CREDIT", includeInNetWorth:type !== "STORED_CREDIT", syncMethod:"MANUAL", lastSyncedAt:new Date() } });
    await database.accountBalanceSnapshot.create({ data: { accountId:created.id, balance, availableBalance:balance, source:"manual" } });
    await database.auditLog.create({ data: { entityType:"FinancialAccount", entityId:created.id, action:"CREATE", actorType:"USER", after:{ name, provider, type, balance } } });
    return created;
  });
  return NextResponse.json({ id: account.id }, { status: 201 });
}
