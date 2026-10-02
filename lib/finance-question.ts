import OpenAI from "openai";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { trackingStartDay } from "./tracking";

type Plan = {
  dataset:
    "transactions" | "accounts" | "receipts" | "receipt_items" | "investments";
  metric:
    | "total"
    | "count"
    | "list"
    | "balance"
    | "net_worth"
    | "gain"
    | "cost_basis"
    | "deposits"
    | "withdrawals"
    | "allocation";
  start_date: string | null;
  end_date: string | null;
  merchant_query: string | null;
  category_query: string | null;
  item_query: string | null;
  attribute_query: string | null;
  purchase_channel: "any" | "online" | "in_store" | "delivery" | "unknown";
  location_query: string | null;
  account_query: string | null;
  direction: "any" | "in" | "out";
  explanation: string;
};

export type FinanceAnswer = {
  answer: string;
  detail: string;
  scope: string;
  citations: Array<{
    id: string;
    type: string;
    label: string;
    detail: string;
    amount?: number;
  }>;
};

const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

async function planQuestion(question: string): Promise<Plan> {
  if (!process.env.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY is not configured.");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const today = new Date().toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  const response = await client.responses.create({
    model:
      process.env.OPENAI_FINANCE_MODEL ||
      process.env.OPENAI_CLASSIFIER_MODEL ||
      "gpt-4o-mini",
    instructions: `Convert a personal-finance question into one safe analytics plan. Never write SQL and never invent records. Transactions means everyday bank/card activity. Receipt_items means individual products or prepared foods extracted from receipts, such as potatoes, sandwiches, or shampoo. Use receipt_items when the user asks about a specific purchased item; use transactions when asking about merchants, transaction categories, cuisine, venue type, service style, purchase channel, or location. Investments means brokerage and retirement holdings or investment activity. Deposits and withdrawals for investments refer to transfers into or out of investment accounts, not buys/sells. Use accounts with net_worth for total net worth. category_query is a category or subcategory such as Dining, Groceries, Coffee Shops, or Vegetables. attribute_query is a cuisine, dining venue, or service style such as Thai, cafe, or delivery. Dates are inclusive and must be YYYY-MM-DD. Today is ${today}. For 'this year', use ${year}-01-01 through ${today}. For spending, use direction out and metric total. Preserve search phrases from the question. Keep explanation to one short sentence.`,
    input: question,
    text: {
      format: {
        type: "json_schema",
        name: "finance_question_plan",
        strict: true,
        schema: {
          type: "object",
          properties: {
            dataset: {
              type: "string",
              enum: [
                "transactions",
                "accounts",
                "receipts",
                "receipt_items",
                "investments",
              ],
            },
            metric: {
              type: "string",
              enum: [
                "total",
                "count",
                "list",
                "balance",
                "net_worth",
                "gain",
                "cost_basis",
                "deposits",
                "withdrawals",
                "allocation",
              ],
            },
            start_date: { type: ["string", "null"] },
            end_date: { type: ["string", "null"] },
            merchant_query: { type: ["string", "null"] },
            category_query: { type: ["string", "null"] },
            item_query: { type: ["string", "null"] },
            attribute_query: { type: ["string", "null"] },
            purchase_channel: {
              type: "string",
              enum: ["any", "online", "in_store", "delivery", "unknown"],
            },
            location_query: { type: ["string", "null"] },
            account_query: { type: ["string", "null"] },
            direction: { type: "string", enum: ["any", "in", "out"] },
            explanation: { type: "string" },
          },
          required: [
            "dataset",
            "metric",
            "start_date",
            "end_date",
            "merchant_query",
            "category_query",
            "item_query",
            "attribute_query",
            "purchase_channel",
            "location_query",
            "account_query",
            "direction",
            "explanation",
          ],
          additionalProperties: false,
        },
      },
    },
  });
  if (!response.output_text)
    throw new Error("The finance assistant returned no plan.");
  return JSON.parse(response.output_text) as Plan;
}

function matchingCategoryIds(
  categories: Array<{ id: string; name: string; parentId: string | null }>,
  query: string | null,
) {
  if (!query) return [];
  const byId = new Map(categories.map((category) => [category.id, category]));
  const path = (category: (typeof categories)[number]) => {
    const names = [category.name];
    let parentId = category.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parent.parentId;
    }
    return names.join(" › ");
  };
  const needle = query.toLowerCase();
  return categories
    .filter((category) => path(category).toLowerCase().includes(needle))
    .map((category) => category.id);
}

function dateBounds(plan: Plan, trackingStartedAt: Date | null) {
  const trackingDay = trackingStartDay(trackingStartedAt);
  const start =
    [plan.start_date, trackingDay]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const end = plan.end_date ?? new Date().toISOString().slice(0, 10);
  return {
    start,
    end,
    startDate: start ? new Date(`${start}T00:00:00.000Z`) : undefined,
    endDate: new Date(`${end}T23:59:59.999Z`),
    trackingDay,
  };
}

export async function answerFinanceQuestion(
  question: string,
): Promise<FinanceAnswer> {
  const user = await prisma.user.findUnique({
    where: { email: "alex@ledgerly.local" },
    include: {
      accounts: { where: { isActive: true } },
      categories: { where: { isActive: true } },
    },
  });
  if (!user) throw new Error("Local user not found.");
  const plan = await planQuestion(question);
  const bounds = dateBounds(plan, user.trackingStartedAt);
  const scope =
    plan.dataset === "investments"
      ? `${plan.start_date ?? "available history"} through ${plan.end_date ?? "today"}`
      : `${bounds.start ?? "available tracked history"} through ${bounds.end}`;

  const categoryIds = matchingCategoryIds(user.categories, plan.category_query);

  if (plan.dataset === "transactions") {
    const filters: Prisma.TransactionWhereInput[] = [];
    if (plan.merchant_query)
      filters.push({
        OR: [
          {
            merchantNormalized: {
              contains: plan.merchant_query,
              mode: "insensitive",
            },
          },
          {
            merchantRaw: { contains: plan.merchant_query, mode: "insensitive" },
          },
        ],
      });
    if (plan.category_query) filters.push({ categoryId: { in: categoryIds } });
    if (plan.attribute_query)
      filters.push({
        OR: [
          {
            diningCuisine: {
              contains: plan.attribute_query,
              mode: "insensitive",
            },
          },
          {
            diningVenueType: {
              contains: plan.attribute_query,
              mode: "insensitive",
            },
          },
          {
            diningServiceStyle: {
              contains: plan.attribute_query,
              mode: "insensitive",
            },
          },
        ],
      });
    if (plan.purchase_channel !== "any")
      filters.push({ paymentChannel: plan.purchase_channel.toUpperCase() });
    if (plan.location_query)
      filters.push({
        OR: [
          {
            locationAddress: {
              contains: plan.location_query,
              mode: "insensitive",
            },
          },
          {
            locationCity: {
              contains: plan.location_query,
              mode: "insensitive",
            },
          },
          {
            locationRegion: {
              contains: plan.location_query,
              mode: "insensitive",
            },
          },
          {
            locationPostalCode: {
              contains: plan.location_query,
              mode: "insensitive",
            },
          },
        ],
      });
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        transactedAt: {
          ...(bounds.startDate ? { gte: bounds.startDate } : {}),
          lte: bounds.endDate,
        },
        ...(plan.direction === "out"
          ? { amount: { lt: 0 } }
          : plan.direction === "in"
            ? { amount: { gt: 0 } }
            : {}),
        AND: filters,
        ...(plan.account_query
          ? {
              sourceAccount: {
                OR: [
                  {
                    name: { contains: plan.account_query, mode: "insensitive" },
                  },
                  {
                    provider: {
                      contains: plan.account_query,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            }
          : {}),
      },
      include: { sourceAccount: true, category: true },
      orderBy: { transactedAt: "desc" },
      take: 500,
    });
    const total = transactions.reduce(
      (sum, transaction) => sum + Math.abs(Number(transaction.amount)),
      0,
    );
    const citations = transactions.slice(0, 10).map((transaction) => ({
      id: transaction.id,
      type: "transaction",
      label: transaction.merchantNormalized ?? transaction.merchantRaw,
      detail: `${transaction.transactedAt.toISOString().slice(0, 10)} · ${transaction.sourceAccount.name} · ${transaction.category?.name ?? "Uncategorized"}${transaction.diningCuisine ? ` · ${transaction.diningCuisine}` : ""}${transaction.diningVenueType ? ` · ${transaction.diningVenueType}` : ""}${transaction.diningServiceStyle ? ` · ${transaction.diningServiceStyle}` : ""}`,
      amount: Number(transaction.amount),
    }));
    const answer =
      plan.metric === "count"
        ? `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`
        : plan.metric === "list"
          ? `${transactions.length} matching transaction${transactions.length === 1 ? "" : "s"}`
          : money(total);
    return {
      answer,
      detail: transactions.length
        ? `${plan.explanation} Based on ${transactions.length} matching record${transactions.length === 1 ? "" : "s"}.`
        : `No matching tracked transactions were found. Everyday tracking begins ${bounds.trackingDay}.`,
      scope,
      citations,
    };
  }

  if (plan.dataset === "receipt_items") {
    const receiptFilters: Prisma.ReceiptWhereInput[] = [
      {
        OR: [
          {
            purchasedAt: {
              ...(bounds.startDate ? { gte: bounds.startDate } : {}),
              lte: bounds.endDate,
            },
          },
          {
            purchasedAt: null,
            createdAt: {
              ...(bounds.startDate ? { gte: bounds.startDate } : {}),
              lte: bounds.endDate,
            },
          },
        ],
      },
    ];
    if (plan.merchant_query)
      receiptFilters.push({
        merchant: { contains: plan.merchant_query, mode: "insensitive" },
      });
    if (plan.attribute_query)
      receiptFilters.push({
        OR: [
          {
            diningCuisine: {
              contains: plan.attribute_query,
              mode: "insensitive",
            },
          },
          {
            diningVenueType: {
              contains: plan.attribute_query,
              mode: "insensitive",
            },
          },
          {
            diningServiceStyle: {
              contains: plan.attribute_query,
              mode: "insensitive",
            },
          },
        ],
      });
    if (plan.purchase_channel !== "any")
      receiptFilters.push({
        purchaseChannel: plan.purchase_channel.toUpperCase(),
      });
    if (plan.location_query)
      receiptFilters.push({
        OR: [
          {
            locationAddress: {
              contains: plan.location_query,
              mode: "insensitive",
            },
          },
          {
            locationCity: {
              contains: plan.location_query,
              mode: "insensitive",
            },
          },
          {
            locationRegion: {
              contains: plan.location_query,
              mode: "insensitive",
            },
          },
          {
            locationPostalCode: {
              contains: plan.location_query,
              mode: "insensitive",
            },
          },
        ],
      });
    const items = await prisma.receiptItem.findMany({
      where: {
        receipt: { userId: user.id, AND: receiptFilters },
        ...(plan.item_query
          ? {
              OR: [
                {
                  normalizedName: {
                    contains: plan.item_query,
                    mode: "insensitive",
                  },
                },
                { rawName: { contains: plan.item_query, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(plan.category_query ? { categoryId: { in: categoryIds } } : {}),
      },
      include: { receipt: true, category: true },
      orderBy: { receipt: { purchasedAt: "desc" } },
      take: 500,
    });
    const total = items.reduce((sum, item) => sum + Number(item.price), 0);
    return {
      answer:
        plan.metric === "count" || plan.metric === "list"
          ? `${items.length} item${items.length === 1 ? "" : "s"}`
          : money(total),
      detail: items.length
        ? `${plan.explanation} Based on ${items.length} extracted receipt line item${items.length === 1 ? "" : "s"}; linked bank transactions are not added again.`
        : "No matching receipt line items were found in the tracked period.",
      scope,
      citations: items.slice(0, 10).map((item) => ({
        id: item.id,
        type: "receipt item",
        label: item.normalizedName ?? item.rawName,
        detail: `${(item.receipt.purchasedAt ?? item.receipt.createdAt).toISOString().slice(0, 10)} · ${item.receipt.merchant ?? item.receipt.originalFilename} · ${item.category?.name ?? "Uncategorized"}`,
        amount: Number(item.price),
      })),
    };
  }

  if (plan.dataset === "accounts") {
    const accounts = user.accounts.filter(
      (account) =>
        !plan.account_query ||
        `${account.name} ${account.provider}`
          .toLowerCase()
          .includes(plan.account_query.toLowerCase()),
    );
    const included =
      plan.metric === "net_worth"
        ? accounts.filter((account) => account.includeInNetWorth)
        : accounts;
    const total = included.reduce(
      (sum, account) => sum + Number(account.currentBalance),
      0,
    );
    return {
      answer:
        plan.metric === "count"
          ? `${included.length} account${included.length === 1 ? "" : "s"}`
          : money(total),
      detail:
        plan.metric === "net_worth"
          ? "Current balances across accounts included in net worth."
          : plan.explanation,
      scope: "Current balances",
      citations: included.map((account) => ({
        id: account.id,
        type: "account",
        label: account.name,
        detail: `${account.provider} · ${account.type.toLowerCase()}`,
        amount: Number(account.currentBalance),
      })),
    };
  }

  if (plan.dataset === "receipts") {
    const receipts = await prisma.receipt.findMany({
      where: {
        userId: user.id,
        createdAt: {
          ...(bounds.startDate ? { gte: bounds.startDate } : {}),
          lte: bounds.endDate,
        },
        ...(plan.merchant_query
          ? { merchant: { contains: plan.merchant_query, mode: "insensitive" } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const total = receipts.reduce(
      (sum, receipt) => sum + Number(receipt.total ?? 0),
      0,
    );
    return {
      answer:
        plan.metric === "count" || plan.metric === "list"
          ? `${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`
          : money(total),
      detail: receipts.length
        ? plan.explanation
        : "No matching tracked receipts were found.",
      scope,
      citations: receipts.slice(0, 10).map((receipt) => ({
        id: receipt.id,
        type: "receipt",
        label: receipt.merchant ?? receipt.originalFilename,
        detail: `${(receipt.purchasedAt ?? receipt.createdAt).toISOString().slice(0, 10)} · ${receipt.source.toLowerCase().replaceAll("_", " ")}`,
        amount: receipt.total === null ? undefined : Number(receipt.total),
      })),
    };
  }

  const matchingAccounts = user.accounts.filter(
    (account) =>
      account.type === "INVESTMENT" &&
      (!plan.account_query ||
        `${account.name} ${account.provider}`
          .toLowerCase()
          .includes(plan.account_query.toLowerCase())),
  );
  const accountIds = matchingAccounts.map((account) => account.id);
  if (
    ["deposits", "withdrawals", "total", "count", "list"].includes(plan.metric)
  ) {
    const startDate = plan.start_date
      ? new Date(`${plan.start_date}T00:00:00.000Z`)
      : undefined;
    const endDate = new Date(
      `${plan.end_date ?? new Date().toISOString().slice(0, 10)}T23:59:59.999Z`,
    );
    const activities = await prisma.investmentTransaction.findMany({
      where: {
        accountId: { in: accountIds },
        date: { ...(startDate ? { gte: startDate } : {}), lte: endDate },
        ...(plan.metric === "deposits"
          ? { type: "transfer", amount: { lt: 0 } }
          : plan.metric === "withdrawals"
            ? { type: "transfer", amount: { gt: 0 } }
            : {}),
      },
      include: { account: true, security: true },
      orderBy: { date: "desc" },
      take: 500,
    });
    const total = activities.reduce(
      (sum, activity) => sum + Math.abs(Number(activity.amount)),
      0,
    );
    return {
      answer:
        plan.metric === "count" || plan.metric === "list"
          ? `${activities.length} investment event${activities.length === 1 ? "" : "s"}`
          : money(total),
      detail: activities.length
        ? `${plan.explanation} Based on ${activities.length} investment record${activities.length === 1 ? "" : "s"}.`
        : "No matching investment activity was found.",
      scope,
      citations: activities.slice(0, 10).map((activity) => ({
        id: activity.id,
        type: "investment activity",
        label: activity.name,
        detail: `${activity.date.toISOString().slice(0, 10)} · ${activity.account.name} · ${activity.type}/${activity.subtype ?? "other"}`,
        amount: Number(activity.amount),
      })),
    };
  }
  const holdings = await prisma.investmentHolding.findMany({
    where: { accountId: { in: accountIds } },
    include: { account: true, security: true },
    orderBy: { institutionValue: "desc" },
  });
  const value = holdings.reduce(
    (sum, holding) => sum + Number(holding.institutionValue),
    0,
  );
  const costBasis = holdings.reduce(
    (sum, holding) => sum + Number(holding.costBasis ?? 0),
    0,
  );
  const result =
    plan.metric === "gain"
      ? value - costBasis
      : plan.metric === "cost_basis"
        ? costBasis
        : value;
  return {
    answer:
      plan.metric === "count" || plan.metric === "list"
        ? `${holdings.length} holding${holdings.length === 1 ? "" : "s"}`
        : money(result),
    detail: holdings.length
      ? plan.explanation
      : "No detailed holdings were provided for the matching investment accounts.",
    scope: "Current investment holdings",
    citations: holdings.slice(0, 10).map((holding) => ({
      id: holding.id,
      type: "holding",
      label: holding.security.tickerSymbol ?? holding.security.name,
      detail: `${holding.account.name} · ${Number(holding.quantity).toLocaleString()} units`,
      amount: Number(holding.institutionValue),
    })),
  };
}
