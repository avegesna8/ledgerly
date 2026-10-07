import type { AccountType, IntegrationConnection } from "@prisma/client";
import { format, subYears } from "date-fns";
import { plaid } from "./plaid";
import { prisma } from "./prisma";
import { decryptToken } from "./token-crypto";

type PlaidAccount = {
  account_id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  balances: {
    current: number | null;
    available: number | null;
    iso_currency_code: string | null;
  };
};

export function financialAccountType(
  type: string,
  subtype: string | null,
): AccountType {
  if (type === "investment" || type === "brokerage") return "INVESTMENT";
  if (type === "credit" || type === "loan") return "LIABILITY";
  if (subtype === "checking") return "CHECKING";
  if (["savings", "money market", "cd"].includes(subtype ?? ""))
    return "SAVINGS";
  return "OTHER";
}

export async function upsertPlaidAccounts({
  userId,
  connection,
  accounts,
}: {
  userId: string;
  connection: IntegrationConnection;
  accounts: PlaidAccount[];
}) {
  const saved = [];
  for (const account of accounts) {
    const balance = account.balances.current ?? account.balances.available ?? 0;
    const existing = await prisma.financialAccount.findUnique({
      where: {
        integrationId_providerAccountId: {
          integrationId: connection.id,
          providerAccountId: account.account_id,
        },
      },
    });
    const financialAccount = await prisma.financialAccount.upsert({
      where: {
        integrationId_providerAccountId: {
          integrationId: connection.id,
          providerAccountId: account.account_id,
        },
      },
      update: {
        name: account.name,
        provider: connection.institutionName ?? "Connected institution",
        type: financialAccountType(account.type, account.subtype),
        subtype: account.subtype,
        mask: account.mask,
        currency: account.balances.iso_currency_code ?? "USD",
        currentBalance: balance,
        availableBalance: account.balances.available,
        isActive: true,
        lastSyncedAt: new Date(),
      },
      create: {
        userId,
        integrationId: connection.id,
        providerAccountId: account.account_id,
        name: account.name,
        provider: connection.institutionName ?? "Connected institution",
        type: financialAccountType(account.type, account.subtype),
        subtype: account.subtype,
        mask: account.mask,
        currency: account.balances.iso_currency_code ?? "USD",
        currentBalance: balance,
        availableBalance: account.balances.available,
        syncMethod: "PERIODIC",
        lastSyncedAt: new Date(),
        includeInNetWorth: !["credit", "loan"].includes(account.type),
      },
    });
    if (!existing || Number(existing.currentBalance) !== balance) {
      await prisma.accountBalanceSnapshot.create({
        data: {
          accountId: financialAccount.id,
          balance,
          availableBalance: account.balances.available,
          source: existing ? "plaid_sync" : "plaid_connect",
        },
      });
    }
    saved.push(financialAccount);
  }
  return saved;
}

export async function syncInvestmentData(
  connection: IntegrationConnection,
  userId: string,
) {
  const accessToken = decryptToken(connection.encryptedAccessToken);
  const snapshotDate = new Date();
  snapshotDate.setUTCHours(0, 0, 0, 0);
  const holdingsResponse = await plaid.investmentsHoldingsGet({
    access_token: accessToken,
  });
  const accounts = await upsertPlaidAccounts({
    userId,
    connection,
    accounts: holdingsResponse.data.accounts as PlaidAccount[],
  });
  const accountByProviderId = new Map(
    accounts.map((account) => [account.providerAccountId, account]),
  );
  const securityByProviderId = new Map<string, string>();

  for (const security of holdingsResponse.data.securities) {
    const saved = await prisma.investmentSecurity.upsert({
      where: {
        userId_plaidSecurityId: {
          userId,
          plaidSecurityId: security.security_id,
        },
      },
      update: {
        name: security.name ?? security.ticker_symbol ?? "Unknown security",
        tickerSymbol: security.ticker_symbol,
        type: security.type,
        closePrice: security.close_price,
        closePriceAsOf: security.close_price_as_of
          ? new Date(`${security.close_price_as_of}T12:00:00Z`)
          : null,
        currency: security.iso_currency_code ?? "USD",
      },
      create: {
        userId,
        plaidSecurityId: security.security_id,
        name: security.name ?? security.ticker_symbol ?? "Unknown security",
        tickerSymbol: security.ticker_symbol,
        type: security.type,
        closePrice: security.close_price,
        closePriceAsOf: security.close_price_as_of
          ? new Date(`${security.close_price_as_of}T12:00:00Z`)
          : null,
        currency: security.iso_currency_code ?? "USD",
      },
    });
    securityByProviderId.set(security.security_id, saved.id);
  }

  const seenByAccount = new Map<string, Set<string>>();
  for (const holding of holdingsResponse.data.holdings) {
    const account = accountByProviderId.get(holding.account_id);
    const securityId = securityByProviderId.get(holding.security_id);
    if (!account || !securityId) continue;
    const seen = seenByAccount.get(account.id) ?? new Set<string>();
    seen.add(securityId);
    seenByAccount.set(account.id, seen);
    await prisma.investmentHolding.upsert({
      where: { accountId_securityId: { accountId: account.id, securityId } },
      update: {
        quantity: holding.quantity,
        institutionPrice: holding.institution_price,
        institutionValue: holding.institution_value,
        costBasis: holding.cost_basis,
        currency: holding.iso_currency_code ?? "USD",
        asOf: new Date(),
      },
      create: {
        accountId: account.id,
        securityId,
        quantity: holding.quantity,
        institutionPrice: holding.institution_price,
        institutionValue: holding.institution_value,
        costBasis: holding.cost_basis,
        currency: holding.iso_currency_code ?? "USD",
      },
    });
    await prisma.investmentHoldingSnapshot.upsert({
      where: {
        accountId_securityId_recordedOn: {
          accountId: account.id,
          securityId,
          recordedOn: snapshotDate,
        },
      },
      update: {
        quantity: holding.quantity,
        institutionPrice: holding.institution_price,
        institutionValue: holding.institution_value,
        costBasis: holding.cost_basis,
        currency: holding.iso_currency_code ?? "USD",
      },
      create: {
        accountId: account.id,
        securityId,
        quantity: holding.quantity,
        institutionPrice: holding.institution_price,
        institutionValue: holding.institution_value,
        costBasis: holding.cost_basis,
        currency: holding.iso_currency_code ?? "USD",
        recordedOn: snapshotDate,
      },
    });
  }
  for (const account of accounts.filter((item) => item.type === "INVESTMENT")) {
    const seen = [...(seenByAccount.get(account.id) ?? new Set<string>())];
    await prisma.investmentHolding.deleteMany({
      where: {
        accountId: account.id,
        ...(seen.length ? { securityId: { notIn: seen } } : {}),
      },
    });
  }

  const historyStart = format(subYears(new Date(), 2), "yyyy-MM-dd");
  const startDate = historyStart;
  const endDate = format(new Date(), "yyyy-MM-dd");
  let offset = 0;
  let importedTransactions = 0;
  while (true) {
    const response = await plaid.investmentsTransactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 500, offset },
    });
    for (const transaction of response.data.investment_transactions) {
      const account = accountByProviderId.get(transaction.account_id);
      if (!account) continue;
      const securityId = transaction.security_id
        ? (securityByProviderId.get(transaction.security_id) ?? null)
        : null;
      await prisma.investmentTransaction.upsert({
        where: {
          accountId_providerTransactionId: {
            accountId: account.id,
            providerTransactionId: transaction.investment_transaction_id,
          },
        },
        update: {
          securityId,
          date: new Date(`${transaction.date}T12:00:00Z`),
          name: transaction.name,
          type: transaction.type,
          subtype: transaction.subtype,
          amount: transaction.amount,
          quantity: transaction.quantity,
          price: transaction.price,
          fees: transaction.fees,
          currency: transaction.iso_currency_code ?? "USD",
        },
        create: {
          accountId: account.id,
          securityId,
          providerTransactionId: transaction.investment_transaction_id,
          date: new Date(`${transaction.date}T12:00:00Z`),
          name: transaction.name,
          type: transaction.type,
          subtype: transaction.subtype,
          amount: transaction.amount,
          quantity: transaction.quantity,
          price: transaction.price,
          fees: transaction.fees,
          currency: transaction.iso_currency_code ?? "USD",
        },
      });
      importedTransactions++;
    }
    offset += response.data.investment_transactions.length;
    if (
      offset >= response.data.total_investment_transactions ||
      !response.data.investment_transactions.length
    )
      break;
  }
  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      products: { set: [...new Set([...connection.products, "INVESTMENTS"])] },
      newAccountsAvailable: false,
      needsAttention: false,
      lastSyncedAt: new Date(),
    },
  });
  return {
    holdings: holdingsResponse.data.holdings.length,
    investmentTransactions: importedTransactions,
  };
}
