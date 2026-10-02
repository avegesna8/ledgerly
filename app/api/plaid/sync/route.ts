import type { TransactionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { plaid } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/token-crypto";
import { classifyTransaction } from "@/lib/ai-classifier";
import { syncInvestmentData, upsertPlaidAccounts } from "@/lib/plaid-data";
import { isTrackedTransactionDate } from "@/lib/tracking";

function classify(
  primary: string | undefined,
  plaidAmount: number,
  description: string,
): { category: string; type: TransactionType } {
  const value = primary ?? "";
  const merchant = description.toLowerCase();
  if (value.startsWith("INCOME")) return { category: "Income", type: "INCOME" };
  if (value.startsWith("TRANSFER"))
    return { category: "Investments", type: "TRANSFER" };
  if (
    merchant.includes("coffee") ||
    merchant.includes("cafe") ||
    merchant.includes("espresso")
  )
    return { category: "Coffee Shops", type: "EXPENSE" };
  if (
    merchant.includes("pizza") ||
    merchant.includes("pasta") ||
    merchant.includes("italian")
  )
    return { category: "Italian & Pasta", type: "EXPENSE" };
  if (value.includes("GROCERIES"))
    return { category: "Groceries", type: "EXPENSE" };
  if (value.includes("FOOD_AND_DRINK"))
    return { category: "Other Prepared Food", type: "EXPENSE" };
  if (value.includes("TRANSPORTATION") || value.includes("GAS"))
    return { category: "Transportation", type: "EXPENSE" };
  if (value.includes("SUBSCRIPTION"))
    return { category: "Subscriptions", type: "EXPENSE" };
  if (plaidAmount < 0) return { category: "Other", type: "REFUND" };
  return { category: "Other", type: "EXPENSE" };
}

export async function POST() {
  const user = await prisma.user.findUnique({
    where: { email: "alex@ledgerly.local" },
    include: { categories: { where: { isActive: true } } },
  });
  if (!user)
    return NextResponse.json(
      { error: "Local user not found." },
      { status: 404 },
    );
  const connections = await prisma.integrationConnection.findMany({
    where: { userId: user.id, provider: "PLAID", status: "ACTIVE" },
    include: { accounts: true },
  });
  const categoryIds = new Map(
    user.categories.map((category) => [category.name, category.id]),
  );
  const categoriesById = new Map(
    user.categories.map((category) => [category.id, category]),
  );
  const parentCategoryIds = new Set(
    user.categories.flatMap((category) =>
      category.parentId ? [category.parentId] : [],
    ),
  );
  const categoryPath = (categoryId: string) => {
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
    return parts.join(" › ");
  };
  const categoryChoices = user.categories
    .filter((category) => !parentCategoryIds.has(category.id))
    .map((category) => ({ id: category.id, path: categoryPath(category.id) }));
  let addedCount = 0,
    modifiedCount = 0,
    removedCount = 0,
    balancesUpdated = 0,
    classifiedCount = 0;
  let holdingsUpdated = 0,
    investmentTransactionsUpdated = 0,
    accountsDiscovered = 0;
  let beforeTrackingStartSkipped = 0;

  try {
    for (const connection of connections) {
      const accessToken = decryptToken(connection.encryptedAccessToken);
      const accountResponse = await plaid.accountsGet({ access_token: accessToken });
      const knownProviderIds = new Set(connection.accounts.map((account) => account.providerAccountId));
      accountsDiscovered += accountResponse.data.accounts.filter((account) => !knownProviderIds.has(account.account_id)).length;
      const savedAccounts = await upsertPlaidAccounts({
        userId: user.id,
        connection,
        accounts: accountResponse.data.accounts,
      });
      let cursor = connection.syncCursor ?? undefined;
      let hasMore = true;
      const accountByProviderId = new Map(
        savedAccounts.map((account) => [
          account.providerAccountId,
          account,
        ]),
      );

      const syncTransactions = connection.products.length === 0 || connection.products.includes("TRANSACTIONS") || connection.products.includes("INVESTMENTS_UNSUPPORTED");
      while (hasMore && syncTransactions) {
        const response = await plaid.transactionsSync({
          access_token: accessToken,
          cursor,
          count: 100,
        });
        const batch = response.data;
        const added = batch.added.filter((item) => isTrackedTransactionDate(item.date, user.trackingStartedAt));
        const modified = batch.modified.filter((item) => isTrackedTransactionDate(item.date, user.trackingStartedAt));
        beforeTrackingStartSkipped += batch.added.length + batch.modified.length - added.length - modified.length;
        const addedIds = new Set(
          added.map((item) => item.transaction_id),
        );
        const rawImport = await prisma.rawImport.create({
          data: {
            source: "plaid_transactions_sync",
            externalId: `${connection.providerConnectionId}:${batch.next_cursor}`,
            payload: JSON.parse(
              JSON.stringify({
                added,
                modified,
                removed: batch.removed,
              }),
            ),
          },
        });

        for (const item of [...added, ...modified]) {
          const account = accountByProviderId.get(item.account_id);
          if (!account) continue;
          const classification = classify(
            item.personal_finance_category?.primary,
            item.amount,
            item.merchant_name ?? item.name,
          );
          const categoryId =
            categoryIds.get(classification.category) ??
            categoryIds.get("Other");
          const merchantName = item.merchant_name?.trim();
          let merchantId: string | null = null;
          if (merchantName) {
            const existingMerchant = await prisma.merchant.findFirst({
              where: item.merchant_entity_id
                ? {
                    userId: user.id,
                    plaidMerchantEntityId: item.merchant_entity_id,
                  }
                : {
                    userId: user.id,
                    name: { equals: merchantName, mode: "insensitive" },
                  },
            });
            const merchant = existingMerchant
              ? await prisma.merchant.update({
                  where: { id: existingMerchant.id },
                  data: {
                    name: merchantName,
                    plaidMerchantEntityId:
                      item.merchant_entity_id ??
                      existingMerchant.plaidMerchantEntityId,
                    website: item.website ?? existingMerchant.website,
                    logoUrl: item.logo_url ?? existingMerchant.logoUrl,
                  },
                })
              : await prisma.merchant.create({
                  data: {
                    userId: user.id,
                    name: merchantName,
                    plaidMerchantEntityId: item.merchant_entity_id ?? null,
                    website: item.website ?? null,
                    logoUrl: item.logo_url ?? null,
                  },
                });
            merchantId = merchant.id;
          }
          const data = {
            userId: user.id,
            transactedAt: new Date(`${item.date}T12:00:00Z`),
            postedAt: item.authorized_date
              ? new Date(`${item.authorized_date}T12:00:00Z`)
              : null,
            merchantRaw: item.original_description ?? item.name,
            merchantNormalized: item.merchant_name ?? item.name,
            merchantId,
            amount: -item.amount,
            currency: item.iso_currency_code ?? "USD",
            status: "NEEDS_REVIEW" as const,
            type: classification.type,
            categoryId,
            rawImportId: rawImport.id,
            authorizedAt: item.authorized_datetime
              ? new Date(item.authorized_datetime)
              : item.authorized_date
                ? new Date(`${item.authorized_date}T12:00:00Z`)
                : null,
            paymentChannel: item.payment_channel,
            website: item.website ?? null,
            logoUrl: item.logo_url ?? null,
            locationAddress: item.location.address,
            locationCity: item.location.city,
            locationRegion: item.location.region,
            locationPostalCode: item.location.postal_code,
            locationCountry: item.location.country,
            locationStoreNumber: item.location.store_number,
            locationLatitude: item.location.lat,
            locationLongitude: item.location.lon,
            locationSource: "PLAID",
          };
          const savedTransaction = await prisma.transaction.upsert({
            where: {
              sourceAccountId_providerTransactionId: {
                sourceAccountId: account.id,
                providerTransactionId: item.transaction_id,
              },
            },
            update: data,
            create: {
              ...data,
              sourceAccountId: account.id,
              providerTransactionId: item.transaction_id,
            },
          });
          if (addedIds.has(item.transaction_id)) {
            addedCount++;
            if (process.env.OPENAI_API_KEY) {
              try {
                const suggestion = await classifyTransaction(
                  {
                    merchant: item.merchant_name ?? item.name,
                    description: item.original_description ?? item.name,
                    amount: -item.amount,
                    date: item.date,
                  },
                  categoryChoices,
                );
                await prisma.$transaction([
                  prisma.aiClassification.create({
                    data: {
                      transactionId: savedTransaction.id,
                      suggestedCategoryId: suggestion.categoryId,
                      confidence: suggestion.confidence,
                      rationale: suggestion.rationale,
                      model: suggestion.model,
                    },
                  }),
                  prisma.transaction.update({
                    where: { id: savedTransaction.id },
                    data: {
                      categoryId: suggestion.categoryId,
                      status: "NEEDS_REVIEW",
                      diningCuisine: suggestion.diningCuisine,
                      diningVenueType: suggestion.diningVenueType,
                      diningServiceStyle: suggestion.diningServiceStyle,
                    },
                  }),
                  prisma.auditLog.create({
                    data: {
                      entityType: "Transaction",
                      entityId: savedTransaction.id,
                      action: "AI_CATEGORY_SUGGESTED",
                      actorType: "AI",
                      before: { categoryId },
                      after: {
                        categoryId: suggestion.categoryId,
                        confidence: suggestion.confidence,
                        model: suggestion.model,
                      },
                    },
                  }),
                ]);
                classifiedCount++;
              } catch (classificationError) {
                console.error(
                  "Transaction classification error",
                  classificationError,
                );
              }
            }
          } else modifiedCount++;
        }

        for (const removed of batch.removed) {
          const transaction = await prisma.transaction.findFirst({
            where: {
              userId: user.id,
              providerTransactionId: removed.transaction_id,
            },
          });
          if (!transaction) continue;
          await prisma.$transaction([
            prisma.auditLog.create({
              data: {
                entityType: "Transaction",
                entityId: transaction.id,
                action: "PROVIDER_REMOVE",
                actorType: "INTEGRATION",
                before: {
                  providerTransactionId: removed.transaction_id,
                  amount: Number(transaction.amount),
                },
              },
            }),
            prisma.transaction.delete({ where: { id: transaction.id } }),
          ]);
          removedCount++;
        }

        cursor = batch.next_cursor;
        hasMore = batch.has_more;
      }

      for (const plaidAccount of accountResponse.data.accounts) {
        const account = accountByProviderId.get(plaidAccount.account_id);
        if (!account) continue;
        const balance =
          plaidAccount.balances.current ??
          plaidAccount.balances.available ??
          Number(account.currentBalance);
        const changed = Number(account.currentBalance) !== balance;
        await prisma.financialAccount.update({
          where: { id: account.id },
          data: {
            currentBalance: balance,
            availableBalance: plaidAccount.balances.available,
            lastSyncedAt: new Date(),
          },
        });
        if (changed) {
          await prisma.accountBalanceSnapshot.create({
            data: {
              accountId: account.id,
              balance,
              availableBalance: plaidAccount.balances.available,
              source: "plaid_sync",
            },
          });
          balancesUpdated++;
        }
      }
      if (!connection.products.includes("INVESTMENTS_UNSUPPORTED") && (connection.products.includes("INVESTMENTS") || savedAccounts.some((account) => account.type === "INVESTMENT"))) {
        try {
          const investmentResult = await syncInvestmentData(connection, user.id);
          holdingsUpdated += investmentResult.holdings;
          investmentTransactionsUpdated += investmentResult.investmentTransactions;
        } catch (investmentError) {
          console.error("Plaid investment sync error", investmentError);
          const message = typeof investmentError === "object" && investmentError && "response" in investmentError
            ? (investmentError as { response?: { data?: { error_message?: string } } }).response?.data?.error_message
            : undefined;
          if (message?.toLowerCase().includes("investments not supported")) {
            await prisma.integrationConnection.update({
              where:{ id:connection.id },
              data:{ products:{ set:[...new Set([...connection.products,"TRANSACTIONS","INVESTMENTS_UNSUPPORTED"])] } },
            });
          }
        }
      }
      await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: {
          syncCursor: cursor,
          lastSyncedAt: new Date(),
          status: "ACTIVE",
        },
      });
    }
    return NextResponse.json({
      connections: connections.length,
      added: addedCount,
      modified: modifiedCount,
      removed: removedCount,
      balancesUpdated,
      classified: classifiedCount,
      accountsDiscovered,
      holdings: holdingsUpdated,
      investmentTransactions: investmentTransactionsUpdated,
      beforeTrackingStartSkipped,
    });
  } catch (error) {
    console.error("Plaid sync error", error);
    const message =
      typeof error === "object" && error && "response" in error
        ? (error as { response?: { data?: { error_message?: string } } })
            .response?.data?.error_message
        : undefined;
    return NextResponse.json(
      { error: message ?? "Plaid synchronization failed." },
      { status: 502 },
    );
  }
}
