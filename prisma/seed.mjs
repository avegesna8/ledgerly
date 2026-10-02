import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categoryNames = [
  "Income",
  "Groceries",
  "Dining",
  "Transportation",
  "Subscriptions",
  "Investments",
  "Reimbursements",
  "Other",
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "alex@ledgerly.local" },
    update: { name: "Alex" },
    create: { email: "alex@ledgerly.local", name: "Alex" },
  });

  const categories = new Map();
  for (const name of categoryNames) {
    const category =
      (await prisma.category.findFirst({
        where: { userId: user.id, parentId: null, name },
      })) ??
      (await prisma.category.create({
        data: { userId: user.id, name },
      }));
    categories.set(name, category);
  }

  const checking = await prisma.financialAccount.upsert({
    where: { id: "seed-checking" },
    update: {},
    create: {
      id: "seed-checking",
      userId: user.id,
      name: "Primary Checking",
      provider: "Bank of America",
      type: "CHECKING",
      currentBalance: 8424.62,
      availableBalance: 8424.62,
      syncMethod: "MANUAL",
      lastSyncedAt: new Date(),
    },
  });

  const savings = await prisma.financialAccount.upsert({
    where: { id: "seed-savings" },
    update: {},
    create: {
      id: "seed-savings",
      userId: user.id,
      name: "Emergency Savings",
      provider: "Bank of America",
      type: "SAVINGS",
      currentBalance: 12850,
      availableBalance: 12850,
      syncMethod: "MANUAL",
      lastSyncedAt: new Date(),
    },
  });

  const investment = await prisma.financialAccount.upsert({
    where: { id: "seed-investment" },
    update: {},
    create: {
      id: "seed-investment",
      userId: user.id,
      name: "Individual Brokerage",
      provider: "Robinhood",
      type: "INVESTMENT",
      currentBalance: 19420.36,
      availableBalance: 19420.36,
      syncMethod: "MANUAL",
      lastSyncedAt: new Date(),
    },
  });

  const accounts = [checking, savings, investment];
  for (const account of accounts) {
    const existing = await prisma.accountBalanceSnapshot.findFirst({
      where: { accountId: account.id },
    });
    if (!existing) {
      await prisma.accountBalanceSnapshot.create({
        data: {
          accountId: account.id,
          balance: account.currentBalance,
          availableBalance: account.availableBalance,
          source: "seed",
        },
      });
    }
  }

  const existingTransactions = await prisma.transaction.count({
    where: { userId: user.id },
  });

  if (existingTransactions === 0) {
    await prisma.transaction.createMany({
      data: [
        { userId: user.id, sourceAccountId: checking.id, providerTransactionId: "seed-payroll", transactedAt: new Date("2026-09-27T12:00:00Z"), postedAt: new Date("2026-09-27T12:00:00Z"), merchantRaw: "PAYROLL DIRECT DEPOSIT", merchantNormalized: "Payroll", amount: 3200, status: "RECONCILED", type: "INCOME", categoryId: categories.get("Income").id },
        { userId: user.id, sourceAccountId: checking.id, providerTransactionId: "seed-publix", transactedAt: new Date("2026-09-26T17:30:00Z"), postedAt: new Date("2026-09-27T12:00:00Z"), merchantRaw: "PUBLIX #1428", merchantNormalized: "Publix", amount: -87.42, status: "RECONCILED", type: "EXPENSE", categoryId: categories.get("Groceries").id },
        { userId: user.id, sourceAccountId: checking.id, providerTransactionId: "seed-robinhood", transactedAt: new Date("2026-09-25T14:00:00Z"), postedAt: new Date("2026-09-25T14:00:00Z"), merchantRaw: "ROBINHOOD TRANSFER", merchantNormalized: "Robinhood", amount: -500, status: "RECONCILED", type: "TRANSFER", categoryId: categories.get("Investments").id },
        { userId: user.id, sourceAccountId: checking.id, providerTransactionId: "seed-coffee", transactedAt: new Date("2026-09-24T13:15:00Z"), postedAt: new Date("2026-09-24T13:15:00Z"), merchantRaw: "BLUE BOTTLE COFFEE", merchantNormalized: "Blue Bottle Coffee", amount: -6.75, status: "NEEDS_REVIEW", type: "EXPENSE", categoryId: categories.get("Dining").id },
      ],
    });
  }

  console.log(`Seeded ${user.email}: ${accounts.length} accounts, ${categoryNames.length} categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
