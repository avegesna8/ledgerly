import { format } from "date-fns";
import type {
  Account,
  AccountKind,
  CategoryOption,
  DashboardMetrics,
  InvestmentDashboard,
  PlaidConnectionData,
  ReceiptConnectionData,
  ReceiptData,
  Transaction,
  TransactionStatus,
} from "./types";
import { prisma } from "./prisma";
import { trackingStartDay } from "./tracking";

const kinds: Record<string, AccountKind> = {
  CHECKING: "checking",
  SAVINGS: "savings",
  INVESTMENT: "investment",
  WALLET: "wallet",
  CASH: "cash",
  STORED_CREDIT: "credit",
  LIABILITY: "credit",
  OTHER: "cash",
};
const colors = ["#22463b", "#647c72", "#9b795d", "#7088a3", "#b19b6b"];
const statuses: Record<string, TransactionStatus> = {
  RECONCILED: "reconciled",
  NEEDS_REVIEW: "needs-review",
  PENDING: "pending",
  POSTED: "pending",
  CONFIRMED: "reconciled",
  IGNORED: "reconciled",
};

function iconFor(merchant: string, type: string) {
  const value = merchant.toLowerCase();
  if (type === "INCOME") return "briefcase";
  if (type === "TRANSFER" || value.includes("robinhood")) return "trending";
  if (value.includes("coffee")) return "coffee";
  if (value.includes("venmo")) return "users";
  if (value.includes("spotify")) return "music";
  if (value.includes("shell")) return "car";
  return "shopping";
}

export async function getDashboardData(): Promise<{
  accounts: Account[];
  transactions: Transaction[];
  categories: CategoryOption[];
  receipts: ReceiptData[];
  receiptConnections: ReceiptConnectionData[];
  plaidConnections: PlaidConnectionData[];
  investments: InvestmentDashboard;
  metrics: DashboardMetrics;
}> {
  const user = await prisma.user.findUnique({
    where: { email: "alex@ledgerly.local" },
    include: {
      accounts: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
      categories: { where: { isActive: true }, orderBy: { name: "asc" } },
      transactions: {
        include: { category: { include: { parent: true } }, receipt: true },
        orderBy: { transactedAt: "desc" },
        take: 50,
      },
    },
  });
  if (!user) throw new Error("Local user not found. Run npm run db:seed.");
  const categoriesById = new Map(
    user.categories.map((category) => [category.id, category]),
  );
  const categoryPath = (categoryId: string | null): string => {
    if (!categoryId) return "Uncategorized";
    const parts: string[] = [];
    let current = categoriesById.get(categoryId);
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      parts.unshift(current.name);
      current = current.parentId
        ? categoriesById.get(current.parentId)
        : undefined;
    }
    return parts.join(" › ") || "Uncategorized";
  };
  const rootCategory = (categoryId: string | null): string =>
    categoryPath(categoryId).split(" › ")[0];
  const snapshots = await prisma.accountBalanceSnapshot.findMany({
    where: { account: { userId: user.id } },
    orderBy: { recordedAt: "asc" },
    include: { account: true },
  });
  const receipts = await prisma.receipt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { transaction: true, items: { include: { category: true } } },
  });
  const receiptConnections = await prisma.receiptSourceConnection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  const plaidConnections = await prisma.integrationConnection.findMany({
    where: { userId: user.id, provider: "PLAID" },
    include: { accounts: { where: { isActive: true } } },
    orderBy: { createdAt: "asc" },
  });
  const investmentHoldings = await prisma.investmentHolding.findMany({
    where: { account: { userId: user.id, isActive: true } },
    include: { account: true, security: true },
    orderBy: { institutionValue: "desc" },
  });
  const investmentActivities = await prisma.investmentTransaction.findMany({
    where: { account: { userId: user.id, isActive: true } },
    include: { account: true, security: true },
    orderBy: { date: "desc" },
    take: 100,
  });
  const now = new Date();
  const startDay = trackingStartDay(user.trackingStartedAt);
  const trackedTransactions = user.transactions.filter(
    (transaction) =>
      !startDay ||
      transaction.transactedAt.toISOString().slice(0, 10) >= startDay,
  );
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentTransactions = trackedTransactions.filter(
    (transaction) => transaction.transactedAt >= monthStart,
  );
  const moneyIn = currentTransactions
    .filter((transaction) =>
      ["INCOME", "REFUND", "REIMBURSEMENT"].includes(transaction.type),
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const moneyOut = Math.abs(
    currentTransactions
      .filter((transaction) => transaction.type === "EXPENSE")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0),
  );
  const internalTransfers = Math.abs(
    currentTransactions
      .filter((transaction) => transaction.type === "TRANSFER")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0),
  );
  const spendTransactions = currentTransactions.filter(
    (transaction) => transaction.type === "EXPENSE",
  );
  const reconciledAmount = Math.abs(
    spendTransactions
      .filter((transaction) =>
        ["RECONCILED", "CONFIRMED"].includes(transaction.status),
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0),
  );
  const needsDetailsAmount = Math.max(0, moneyOut - reconciledAmount);
  const palette = [
    "#284c40",
    "#ab7650",
    "#7088a3",
    "#b6a171",
    "#9a8770",
    "#8b6f75",
  ];
  const categoryTotals = new Map<string, number>();
  spendTransactions.forEach((transaction) => {
    const name = rootCategory(transaction.categoryId);
    categoryTotals.set(
      name,
      (categoryTotals.get(name) ?? 0) + Math.abs(Number(transaction.amount)),
    );
  });
  const spendingByCategory = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      color: palette[index % palette.length],
    }));
  const netWorthHistory = [
    ...new Set(
      snapshots.map((snapshot) => format(snapshot.recordedAt, "yyyy-MM")),
    ),
  ].map((key) => {
    const monthSnapshots = snapshots.filter(
      (snapshot) =>
        format(snapshot.recordedAt, "yyyy-MM") === key &&
        snapshot.account.includeInNetWorth,
    );
    const latestByAccount = new Map<string, (typeof monthSnapshots)[number]>();
    monthSnapshots.forEach((snapshot) =>
      latestByAccount.set(snapshot.accountId, snapshot),
    );
    return {
      month: format(new Date(`${key}-15T12:00:00`), "MMM"),
      value: [...latestByAccount.values()].reduce(
        (sum, snapshot) => sum + Number(snapshot.balance),
        0,
      ),
    };
  });
  const netWorth = user.accounts
    .filter((account) => account.includeInNetWorth)
    .reduce((sum, account) => sum + Number(account.currentBalance), 0);
  const liquid = user.accounts
    .filter(
      (account) =>
        account.includeInNetWorth &&
        ["CHECKING", "SAVINGS", "WALLET", "CASH"].includes(account.type),
    )
    .reduce((sum, account) => sum + Number(account.currentBalance), 0);
  const investments = user.accounts
    .filter(
      (account) => account.includeInNetWorth && account.type === "INVESTMENT",
    )
    .reduce((sum, account) => sum + Number(account.currentBalance), 0);
  const storedValue = user.accounts
    .filter((account) => account.type === "STORED_CREDIT")
    .reduce((sum, account) => sum + Number(account.currentBalance), 0);
  const staleAccounts = user.accounts.filter(
    (account) =>
      !account.lastSyncedAt ||
      now.getTime() - account.lastSyncedAt.getTime() > 30 * 24 * 60 * 60 * 1000,
  ).length;
  const reviewCount =
    trackedTransactions.filter((transaction) =>
      ["NEEDS_REVIEW", "PENDING"].includes(transaction.status),
    ).length +
    staleAccounts +
    receipts.filter(
      (receipt) => !["CONFIRMED", "REJECTED"].includes(receipt.status),
    ).length;
  return {
    accounts: user.accounts.map((account, index) => ({
      id: account.id,
      name: account.name,
      institution: account.provider,
      kind: kinds[account.type],
      balance: Number(account.currentBalance),
      change: 0,
      color: colors[index % colors.length],
      automatic: account.syncMethod !== "MANUAL",
      includeInNetWorth: account.includeInNetWorth,
      lastSyncedAt: account.lastSyncedAt?.toISOString(),
      lastFour: account.mask ?? undefined,
      stale:
        !account.lastSyncedAt ||
        now.getTime() - account.lastSyncedAt.getTime() >
          30 * 24 * 60 * 60 * 1000,
    })),
    transactions: trackedTransactions.map((transaction) => {
      const merchant =
        transaction.merchantNormalized ?? transaction.merchantRaw;
      const location = [
        transaction.locationAddress,
        transaction.locationCity,
        transaction.locationRegion,
        transaction.locationPostalCode,
      ]
        .filter(Boolean)
        .join(", ");
      return {
        id: transaction.id,
        merchant,
        description:
          transaction.type === "TRANSFER"
            ? "Investment transfer"
            : transaction.merchantRaw,
        date: format(transaction.transactedAt, "MMM d"),
        amount: Number(transaction.amount),
        category: categoryPath(transaction.categoryId),
        categoryId: transaction.categoryId ?? undefined,
        accountId: transaction.sourceAccountId,
        status: statuses[transaction.status],
        icon: iconFor(merchant, transaction.type),
        transactionType: transaction.type,
        transactedAt: transaction.transactedAt.toISOString(),
        location: location || undefined,
        latitude: transaction.locationLatitude ?? undefined,
        longitude: transaction.locationLongitude ?? undefined,
        mapsUrl: transaction.locationMapsUrl ?? undefined,
        website: transaction.website ?? undefined,
        paymentChannel: transaction.paymentChannel ?? undefined,
        diningCuisine: transaction.diningCuisine ?? undefined,
        diningVenueType: transaction.diningVenueType ?? undefined,
        diningServiceStyle: transaction.diningServiceStyle ?? undefined,
        receiptId: transaction.receipt?.id,
        receiptSource: transaction.receipt?.source,
        receiptStatus: transaction.receipt?.status
          .toLowerCase()
          .replaceAll("_", " "),
      };
    }),
    categories: user.categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        path: categoryPath(category.id),
        parentId: category.parentId ?? undefined,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    receipts: receipts.map((receipt) => ({
      id: receipt.id,
      filename: receipt.originalFilename,
      sourceUrl: receipt.originalUrl,
      mimeType: receipt.mimeType,
      source: receipt.source,
      status: receipt.status.toLowerCase().replaceAll("_", " "),
      merchant: receipt.merchant ?? undefined,
      purchasedAt: receipt.purchasedAt?.toISOString(),
      total: receipt.total !== null ? Number(receipt.total) : undefined,
      tax: receipt.tax !== null ? Number(receipt.tax) : undefined,
      confidence: receipt.confidence ?? undefined,
      matchConfidence: receipt.matchConfidence ?? undefined,
      transactionId: receipt.transactionId ?? undefined,
      matchedTransaction: receipt.transaction
        ? (receipt.transaction.merchantNormalized ??
          receipt.transaction.merchantRaw)
        : undefined,
      purchaseChannel: receipt.purchaseChannel ?? undefined,
      diningCuisine: receipt.diningCuisine ?? undefined,
      diningVenueType: receipt.diningVenueType ?? undefined,
      diningServiceStyle: receipt.diningServiceStyle ?? undefined,
      locationAddress: receipt.locationAddress ?? undefined,
      locationCity: receipt.locationCity ?? undefined,
      locationRegion: receipt.locationRegion ?? undefined,
      locationPostalCode: receipt.locationPostalCode ?? undefined,
      locationCountry: receipt.locationCountry ?? undefined,
      latitude: receipt.locationLatitude ?? undefined,
      longitude: receipt.locationLongitude ?? undefined,
      mapsUrl: receipt.locationMapsUrl ?? undefined,
      items: receipt.items.map((item) => ({
        id: item.id,
        name: item.normalizedName ?? item.rawName,
        quantity: item.quantity !== null ? Number(item.quantity) : undefined,
        price: Number(item.price),
        category: item.category?.name ?? "Uncategorized",
        categoryId: item.categoryId ?? undefined,
      })),
    })),
    receiptConnections: receiptConnections.map((connection) => {
      const configuration =
        connection.configuration &&
        typeof connection.configuration === "object" &&
        !Array.isArray(connection.configuration)
          ? (connection.configuration as Record<string, unknown>)
          : null;
      return {
        id: connection.id,
        provider: connection.provider,
        displayName: connection.displayName ?? undefined,
        status: connection.status,
        lastSyncedAt: connection.lastSyncedAt?.toISOString(),
        folderName:
          typeof configuration?.folderName === "string"
            ? configuration.folderName
            : undefined,
      };
    }),
    plaidConnections: plaidConnections.map((connection) => ({
      id: connection.id,
      institution: connection.institutionName ?? "Connected institution",
      products: connection.products,
      accountCount: connection.accounts.length,
      newAccountsAvailable: connection.newAccountsAvailable,
      needsAttention: connection.needsAttention,
      consentExpiresAt: connection.consentExpiresAt?.toISOString(),
      lastSyncedAt: connection.lastSyncedAt?.toISOString(),
    })),
    investments: (() => {
      const holdingsValue = investmentHoldings.reduce(
        (sum, holding) => sum + Number(holding.institutionValue),
        0,
      );
      const totalValue = user.accounts
        .filter((account) => account.type === "INVESTMENT")
        .reduce((sum, account) => sum + Number(account.currentBalance), 0);
      const totalCostBasis = investmentHoldings.reduce(
        (sum, holding) => sum + Number(holding.costBasis ?? 0),
        0,
      );
      const totalGain = holdingsValue - totalCostBasis;
      const allocationTotals = new Map<string, number>();
      investmentHoldings.forEach((holding) => {
        const name = holding.security.type?.replaceAll("_", " ") ?? "Other";
        allocationTotals.set(
          name,
          (allocationTotals.get(name) ?? 0) + Number(holding.institutionValue),
        );
      });
      const balanceOnlyValue = Math.max(0, totalValue - holdingsValue);
      if (balanceOnlyValue > 0) {
        allocationTotals.set("Cash & balance-only accounts", balanceOnlyValue);
      }
      const flowKind = (type: string, subtype: string | null) =>
        `${type} ${subtype ?? ""}`.toLowerCase();
      const contributions = investmentActivities
        .filter((activity) => {
          const kind = flowKind(activity.type, activity.subtype);
          return (
            /deposit|contribution|transfer in/.test(kind) ||
            (activity.type.toLowerCase() === "transfer" &&
              Number(activity.amount) < 0)
          );
        })
        .reduce((sum, activity) => sum + Math.abs(Number(activity.amount)), 0);
      const withdrawals = investmentActivities
        .filter((activity) => {
          const kind = flowKind(activity.type, activity.subtype);
          return (
            /withdraw|distribution|transfer out/.test(kind) ||
            (activity.type.toLowerCase() === "transfer" &&
              Number(activity.amount) > 0)
          );
        })
        .reduce((sum, activity) => sum + Math.abs(Number(activity.amount)), 0);
      return {
        totalValue,
        totalCostBasis,
        totalGain,
        gainPercent: totalCostBasis ? (totalGain / totalCostBasis) * 100 : 0,
        contributions,
        withdrawals,
        allocation: [...allocationTotals.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, value], index) => ({
            name,
            value,
            color: palette[index % palette.length],
          })),
        holdings: investmentHoldings.map((holding) => {
          const value = Number(holding.institutionValue);
          const costBasis =
            holding.costBasis === null ? undefined : Number(holding.costBasis);
          const gain = costBasis === undefined ? undefined : value - costBasis;
          return {
            id: holding.id,
            accountId: holding.accountId,
            accountName: holding.account.name,
            institution: holding.account.provider,
            securityName: holding.security.name,
            ticker: holding.security.tickerSymbol ?? undefined,
            securityType: holding.security.type ?? undefined,
            quantity: Number(holding.quantity),
            price:
              holding.institutionPrice === null
                ? undefined
                : Number(holding.institutionPrice),
            value,
            costBasis,
            gain,
            gainPercent:
              costBasis && gain !== undefined
                ? (gain / costBasis) * 100
                : undefined,
          };
        }),
        activities: investmentActivities.map((activity) => ({
          id: activity.id,
          accountId: activity.accountId,
          accountName: activity.account.name,
          date: activity.date.toISOString(),
          name: activity.name,
          securityName: activity.security?.name,
          ticker: activity.security?.tickerSymbol ?? undefined,
          type: activity.type,
          subtype: activity.subtype ?? undefined,
          amount: Number(activity.amount),
          quantity:
            activity.quantity === null ? undefined : Number(activity.quantity),
          price: activity.price === null ? undefined : Number(activity.price),
          fees: activity.fees === null ? undefined : Number(activity.fees),
        })),
      };
    })(),
    metrics: {
      netWorth,
      liquid,
      investments,
      storedValue,
      moneyIn,
      moneyOut,
      internalTransfers,
      netChange: moneyIn - moneyOut,
      reconciliationRate: moneyOut ? (reconciledAmount / moneyOut) * 100 : 100,
      reconciledAmount,
      needsDetailsAmount,
      netWorthHistory,
      spendingByCategory,
      reviewCount,
      trackingStartedAt: user.trackingStartedAt?.toISOString(),
    },
  };
}
