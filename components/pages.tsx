"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArchiveRestore,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Eye,
  Globe2,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type {
  Account,
  DashboardMetrics,
  InvestmentDashboard,
  PlaidConnectionData,
  ReceiptConnectionData,
  ReceiptData,
  Transaction,
} from "@/lib/types";
import { diningLabel } from "@/lib/dining-attributes";
import { TransactionList } from "./transaction-list";
import { AllocationChart, NetWorthChart, SpendingChart } from "./charts";
import { PlaidConnectButton } from "./plaid-connect-button";
import { ReceiptEditModal } from "./receipt-edit-modal";
import { LocationLookupModal } from "./location-lookup-modal";
import { ReceiptPreviewModal } from "./receipt-preview-modal";
import { FinanceAskCard } from "./finance-ask-card";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function PageHeader({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">YOUR FINANCES</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action && (
        <button className="button" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </header>
  );
}

export function TransactionsPage({
  transactions,
  accounts,
  trackingStartedAt,
  onAdd,
  onEdit,
}: {
  transactions: Transaction[];
  accounts: Account[];
  trackingStartedAt?: string;
  onAdd: () => void;
  onEdit: (transaction: Transaction) => void;
}) {
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = useMemo(
    () =>
      transactions.filter((transaction) => {
        const matchesQuery =
          `${transaction.merchant} ${transaction.description} ${transaction.category}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return (
          matchesQuery &&
          (accountFilter === "all" ||
            transaction.accountId === accountFilter) &&
          (statusFilter === "all" || transaction.status === statusFilter)
        );
      }),
    [transactions, query, accountFilter, statusFilter],
  );
  const moneyIn = filtered
    .filter((transaction) => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const moneyOut = Math.abs(
    filtered
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );
  return (
    <>
      <PageHeader
        title="Transactions"
        text="Every movement of money, in one place."
        action="Add transaction"
        onAction={onAdd}
      />
      {trackingStartedAt && (
        <aside className="tracking-start-notice">
          <CircleAlert size={17} />
          <div>
            <strong>
              Everyday transaction tracking starts{" "}
              {new Date(trackingStartedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "America/New_York",
              })}
              .
            </strong>
            <span>
              Earlier bank transactions and receipts are excluded. Historical
              brokerage and retirement activity remains available under
              Investments.
            </span>
          </div>
        </aside>
      )}
      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search merchant, description, or category..."
          />
        </div>
        <div className="filter-select">
          <SlidersHorizontal size={14} />
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
          >
            <option value="all">All accounts</option>
            {accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-select">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="reconciled">Reconciled</option>
            <option value="pending">Pending</option>
            <option value="needs-review">Needs review</option>
          </select>
        </div>
      </div>
      <article className="card page-card">
        <div className="table-summary">
          <span>
            <b>{filtered.length}</b> of {transactions.length} transactions
          </span>
          <span>
            Money in <b className="positive-text">+{money(moneyIn)}</b>
          </span>
          <span>
            Money out <b>−{money(moneyOut)}</b>
          </span>
        </div>
        {filtered.length ? (
          <TransactionList
            full
            transactions={filtered}
            accounts={accounts}
            onEdit={onEdit}
          />
        ) : (
          <div className="empty-state">
            <Search size={22} />
            <strong>No matching transactions</strong>
            <p>Try changing your search or filters.</p>
          </div>
        )}
      </article>
    </>
  );
}

export function AccountsPage({
  accounts,
  metrics,
  investments,
  onAddAccount,
  onEditAccount,
}: {
  accounts: Account[];
  metrics: DashboardMetrics;
  investments: InvestmentDashboard;
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
}) {
  const isRetirement = (account: Account) =>
    /401\s*\(?k\)?|403\s*\(?b\)?|457|retirement|ira|pension/i.test(
      account.name,
    );
  const investmentAccounts = accounts.filter(
    (account) => account.kind === "investment",
  );
  const brokerageAccounts = investmentAccounts.filter(
    (account) => !isRetirement(account),
  );
  const retirementAccounts = investmentAccounts.filter(isRetirement);
  const brokerageIds = new Set(brokerageAccounts.map((account) => account.id));
  const brokerageTransfers = investments.activities.filter(
    (activity) =>
      brokerageIds.has(activity.accountId) &&
      activity.type.toLowerCase() === "transfer",
  );
  const brokerageDeposits = brokerageTransfers
    .filter((activity) => activity.amount < 0)
    .reduce((sum, activity) => sum + Math.abs(activity.amount), 0);
  const brokerageReturns = brokerageTransfers
    .filter((activity) => activity.amount > 0)
    .reduce((sum, activity) => sum + Math.abs(activity.amount), 0);
  const brokerageBalance = brokerageAccounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  const retirementBalance = retirementAccounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  const liquidBalance = accounts
    .filter((account) =>
      ["checking", "savings", "wallet", "cash"].includes(account.kind),
    )
    .reduce((sum, account) => sum + account.balance, 0);
  const explainedAssets = liquidBalance + brokerageBalance + retirementBalance;
  const otherAssets = Math.max(0, metrics.netWorth - explainedAssets);
  const netWorthSources = [
    {
      label: "Bank & liquid cash",
      value: liquidBalance,
      detail: `${accounts.filter((account) => ["checking", "savings", "wallet", "cash"].includes(account.kind)).length} accounts`,
    },
    {
      label: "Brokerage",
      value: brokerageBalance,
      detail: `${brokerageAccounts.length} accounts`,
    },
    {
      label: "401(k) & retirement",
      value: retirementBalance,
      detail: `${retirementAccounts.length} plans`,
    },
    ...(otherAssets > 0
      ? [
          {
            label: "Other assets",
            value: otherAssets,
            detail: "Included assets",
          },
        ]
      : []),
  ];
  return (
    <>
      <PageHeader
        title="Money flow"
        text="See where your money lives and how it moves."
        action="Add account"
        onAction={onAddAccount}
      />
      <section className="net-worth-equation-card">
        <div className="equation-heading">
          <div>
            <span className="label">WHERE YOUR TOTAL COMES FROM</span>
            <h2>Net worth sources</h2>
          </div>
          <p>Balances across your accounts, counted once.</p>
        </div>
        <div className="net-worth-equation">
          {netWorthSources.map((source, index) => (
            <div className="equation-part" key={source.label}>
              {index > 0 && <span className="equation-operator">+</span>}
              <article>
                <small>{source.label}</small>
                <strong>{money(source.value)}</strong>
                <span>{source.detail}</span>
              </article>
            </div>
          ))}
          <span className="equation-operator equals">=</span>
          <article className="equation-total">
            <small>Total net worth</small>
            <strong>{money(metrics.netWorth)}</strong>
            <span>Current connected balances</span>
          </article>
        </div>
        <p className="internal-transfer-note">
          <ArrowRight size={14} />
          <span>
            <strong>{money(brokerageDeposits)} moved into brokerage</strong>{" "}
            changes where your money lives, not the total—cash decreases as
            brokerage increases.
          </span>
        </p>
      </section>
      <section className="flow-summary">
        <div>
          <span>Starting net worth</span>
          <b>{money(metrics.netWorth - metrics.netChange)}</b>
        </div>
        <ArrowRight />
        <div>
          <span>Money in</span>
          <b className="positive-text">+{money(metrics.moneyIn)}</b>
        </div>
        <ArrowRight />
        <div>
          <span>Money out</span>
          <b>−{money(metrics.moneyOut)}</b>
        </div>
        <ArrowRight />
        <div className="accent">
          <span>Ending net worth</span>
          <b>{money(metrics.netWorth)}</b>
        </div>
      </section>
      <section className="cross-account-flow">
        <div>
          <span>Income into banks</span>
          <strong className="positive-text">+{money(metrics.moneyIn)}</strong>
        </div>
        <ArrowRight />
        <div>
          <span>Moved into brokerage</span>
          <strong>{money(brokerageDeposits)}</strong>
        </div>
        <ArrowRight />
        <div>
          <span>Returned from brokerage</span>
          <strong className="positive-text">+{money(brokerageReturns)}</strong>
        </div>
        <ArrowRight />
        <div>
          <span>Everyday spending</span>
          <strong>−{money(metrics.moneyOut)}</strong>
        </div>
      </section>
      <section className="investment-balance-strip">
        <span>Current investment balances</span>
        <div>
          <small>Brokerage</small>
          <strong>{money(brokerageBalance)}</strong>
        </div>
        <i />
        <div>
          <small>401(k) & retirement</small>
          <strong>{money(retirementBalance)}</strong>
        </div>
        <i />
        <div className="total">
          <small>Total investments</small>
          <strong>{money(brokerageBalance + retirementBalance)}</strong>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <span className="label">All locations</span>
          <h2>Your accounts</h2>
        </div>
        <button className="period">Balances⌄</button>
      </div>
      <div className="accounts-grid">
        {accounts.map((a) => (
          <article
            className="account-card editable"
            key={a.id}
            onClick={() => onEditAccount(a)}
            tabIndex={0}
            role="button"
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onEditAccount(a);
            }}
          >
            <div className="account-top">
              <span
                className="institution-mark"
                style={{ background: a.color }}
              >
                {a.institution[0]}
              </span>
              <span>
                <strong>{a.name}</strong>
                <small>
                  {a.institution}
                  {a.lastFour ? ` · •${a.lastFour}` : ""}
                </small>
              </span>
              <ChevronRight size={17} />
            </div>
            <h3>{money(a.balance)}</h3>
            <p className={a.change >= 0 ? "positive-text" : "negative-text"}>
              {a.change >= 0 ? (
                <ArrowUpRight size={14} />
              ) : (
                <ArrowDownLeft size={14} />
              )}{" "}
              {Math.abs(a.change)}% this month
            </p>
            <footer>
              <span className={a.automatic ? "connected" : "manual"}>
                {a.automatic ? "Connected" : "Manual"}
              </span>
              <small>{a.automatic ? "Updated 4m ago" : "Updated Sep 28"}</small>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}

export function InvestmentsPage({
  investments,
  accounts,
  plaidConnections,
  onUpdated,
}: {
  investments: InvestmentDashboard;
  accounts: Account[];
  plaidConnections: PlaidConnectionData[];
  onUpdated: () => void;
}) {
  const [investmentView, setInvestmentView] = useState<
    "overview" | "brokerage" | "retirement"
  >("overview");
  const investmentAccounts = accounts.filter(
    (account) => account.kind === "investment",
  );
  const isRetirementAccount = (account: Account) =>
    /401\s*\(?k\)?|403\s*\(?b\)?|457|retirement|ira|pension/i.test(
      account.name,
    );
  const visibleAccounts =
    investmentView === "overview"
      ? investmentAccounts
      : investmentAccounts.filter((account) =>
          investmentView === "retirement"
            ? isRetirementAccount(account)
            : !isRetirementAccount(account),
        );
  const visibleAccountIds = new Set(
    visibleAccounts.map((account) => account.id),
  );
  const visibleHoldings =
    investmentView === "overview"
      ? investments.holdings
      : investments.holdings.filter((holding) =>
          visibleAccountIds.has(holding.accountId),
        );
  const visibleActivities =
    investmentView === "overview"
      ? investments.activities
      : investments.activities.filter((activity) =>
          visibleAccountIds.has(activity.accountId),
        );
  const visibleCostBasis =
    investmentView === "overview"
      ? investments.totalCostBasis
      : visibleHoldings.reduce(
          (sum, holding) => sum + (holding.costBasis ?? 0),
          0,
        );
  const visibleContributions =
    investmentView === "overview"
      ? investments.contributions
      : visibleActivities
          .filter((activity) => {
            const kind =
              `${activity.type} ${activity.subtype ?? ""}`.toLowerCase();
            return (
              /deposit|contribution|transfer in/.test(kind) ||
              (activity.type.toLowerCase() === "transfer" &&
                activity.amount < 0)
            );
          })
          .reduce((sum, activity) => sum + Math.abs(activity.amount), 0);
  const visibleWithdrawals =
    investmentView === "overview"
      ? investments.withdrawals
      : visibleActivities
          .filter((activity) => {
            const kind =
              `${activity.type} ${activity.subtype ?? ""}`.toLowerCase();
            return (
              /withdraw|distribution|transfer out/.test(kind) ||
              (activity.type.toLowerCase() === "transfer" &&
                activity.amount > 0)
            );
          })
          .reduce((sum, activity) => sum + Math.abs(activity.amount), 0);
  const allocationPalette = [
    "#284c40",
    "#ab7650",
    "#7088a3",
    "#b6a171",
    "#9a8770",
  ];
  const visibleAllocation =
    investmentView === "overview"
      ? investments.allocation
      : [
          ...visibleHoldings
            .reduce((totals, holding) => {
              const name =
                holding.securityType?.replaceAll("_", " ") ?? "Other";
              totals.set(name, (totals.get(name) ?? 0) + holding.value);
              return totals;
            }, new Map<string, number>())
            .entries(),
        ].map(([name, value], index) => ({
          name,
          value,
          color: allocationPalette[index % allocationPalette.length],
        }));
  const visibleBalance = visibleAccounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  const investmentConnections = plaidConnections.filter(
    (connection) =>
      connection.products.includes("INVESTMENTS") ||
      investmentAccounts.some(
        (account) => account.institution === connection.institution,
      ),
  );
  return (
    <>
      <header className="page-header investment-header">
        <div>
          <p className="eyebrow">PORTFOLIO</p>
          <h1>Investments</h1>
          <p>
            Holdings, performance, and money moving into or out of your
            investment accounts.
          </p>
        </div>
        <PlaidConnectButton
          mode="investment"
          label="Connect investment"
          onComplete={onUpdated}
        />
      </header>
      <nav className="investment-tabs" aria-label="Investment views">
        {(["overview", "brokerage", "retirement"] as const).map((view) => (
          <button
            className={investmentView === view ? "active" : ""}
            key={view}
            onClick={() => setInvestmentView(view)}
          >
            {view === "retirement"
              ? "401(k) & retirement"
              : view[0].toUpperCase() + view.slice(1)}
            {view !== "overview" && (
              <span>
                {
                  investmentAccounts.filter((account) =>
                    view === "retirement"
                      ? isRetirementAccount(account)
                      : !isRetirementAccount(account),
                  ).length
                }
              </span>
            )}
          </button>
        ))}
      </nav>
      <section className="investment-summary">
        <article className="investment-total">
          <span>
            {investmentView === "retirement"
              ? "Retirement balance"
              : investmentView === "brokerage"
                ? "Brokerage balance"
                : "Portfolio value"}
          </span>
          <strong>
            {money(
              investmentView === "overview"
                ? investments.totalValue
                : visibleBalance,
            )}
          </strong>
          <small
            className={
              investments.totalGain >= 0 ? "positive-text" : "negative-text"
            }
          >
            {investmentView === "overview" ? (
              <>
                {investments.totalGain >= 0 ? "+" : "−"}
                {money(Math.abs(investments.totalGain))} (
                {Math.abs(investments.gainPercent).toFixed(1)}%) vs. cost basis
              </>
            ) : (
              `${visibleAccounts.length} connected account${visibleAccounts.length === 1 ? "" : "s"}`
            )}
          </small>
        </article>
        <article>
          <span>Cost basis</span>
          <strong>{money(visibleCostBasis)}</strong>
          <small>Across holdings in this view</small>
        </article>
        <article>
          <span>
            {investmentView === "brokerage" ? "Deposited" : "Contributions"}
          </span>
          <strong className="positive-text">
            +{money(visibleContributions)}
          </strong>
          <small>Detected deposits and contributions in this view</small>
        </article>
        <article>
          <span>Withdrawals</span>
          <strong>{money(visibleWithdrawals)}</strong>
          <small>Detected distributions and withdrawals in this view</small>
        </article>
      </section>
      {investmentConnections.some(
        (connection) =>
          !connection.products.includes("INVESTMENTS") &&
          !connection.products.includes("INVESTMENTS_UNSUPPORTED"),
      ) && (
        <article className="investment-consent-banner">
          <BriefcaseBusiness size={20} />
          <div>
            <strong>
              Your 401(k) account is connected, but holdings need permission.
            </strong>
            <p>
              Authorize Investments on the existing institution to import
              positions and activity without duplicating the bank connection.
            </p>
          </div>
          {investmentConnections
            .filter(
              (connection) =>
                !connection.products.includes("INVESTMENTS") &&
                !connection.products.includes("INVESTMENTS_UNSUPPORTED"),
            )
            .map((connection) => (
              <PlaidConnectButton
                key={connection.id}
                mode="update"
                connectionId={connection.id}
                addInvestments
                label={`Enable holdings for ${connection.institution}`}
                onComplete={onUpdated}
              />
            ))}
        </article>
      )}
      {investmentView !== "brokerage" &&
        investmentConnections.some((connection) =>
          connection.products.includes("INVESTMENTS_UNSUPPORTED"),
        ) && (
          <article className="investment-consent-banner unsupported-investments">
            <BriefcaseBusiness size={20} />
            <div>
              <strong>
                Bank of America provides the retirement account balance, but not
                its individual holdings.
              </strong>
              <p>
                Ledgerly will include the 401(k) and employee stock plan
                balances in net worth. Connect the plan’s direct recordkeeper
                separately if it appears in Plaid and you want position-level
                detail.
              </p>
            </div>
          </article>
        )}
      <div className="investment-grid">
        <article className="card chart-card">
          <div className="card-head">
            <div>
              <span className="label">ALLOCATION</span>
              <h3>
                {investmentView === "retirement"
                  ? "Retirement mix"
                  : investmentView === "brokerage"
                    ? "Brokerage mix"
                    : "Portfolio mix"}
              </h3>
            </div>
          </div>
          <AllocationChart data={visibleAllocation} />
        </article>
        <article className="card investment-accounts-card">
          <div className="card-head">
            <div>
              <span className="label">ACCOUNTS</span>
              <h3>
                {investmentView === "retirement"
                  ? "Retirement plans"
                  : investmentView === "brokerage"
                    ? "Brokerage accounts"
                    : "Investment locations"}
              </h3>
            </div>
          </div>
          {visibleAccounts.length ? (
            visibleAccounts.map((account) => (
              <div className="investment-account-row" key={account.id}>
                <span
                  className="institution-mark"
                  style={{ background: account.color }}
                >
                  {account.institution[0]}
                </span>
                <div>
                  <strong>{account.name}</strong>
                  <small>
                    {account.institution}
                    {account.lastFour ? ` · •${account.lastFour}` : ""}
                  </small>
                </div>
                <b>{money(account.balance)}</b>
              </div>
            ))
          ) : (
            <div className="empty-state compact">
              <strong>No accounts in this view</strong>
              <p>
                {investmentView === "retirement"
                  ? "A 401(k), IRA, or retirement plan will appear here."
                  : "Connect Robinhood or another brokerage."}
              </p>
            </div>
          )}
        </article>
      </div>
      <article className="card holdings-card">
        <div className="card-head">
          <div>
            <span className="label">POSITIONS</span>
            <h3>Holdings</h3>
          </div>
          <small>{visibleHoldings.length} positions</small>
        </div>
        {visibleHoldings.length ? (
          <div className="holdings-table">
            <div className="holdings-row holdings-head">
              <span>Security</span>
              <span>Account</span>
              <span>Quantity</span>
              <span>Price</span>
              <span>Value</span>
              <span>Gain / loss</span>
            </div>
            {visibleHoldings.map((holding) => (
              <div className="holdings-row" key={holding.id}>
                <span>
                  <strong>{holding.ticker ?? holding.securityName}</strong>
                  <small>
                    {holding.ticker
                      ? holding.securityName
                      : holding.securityType?.replaceAll("_", " ")}
                  </small>
                </span>
                <span>{holding.accountName}</span>
                <span>
                  {holding.quantity.toLocaleString("en-US", {
                    maximumFractionDigits: 5,
                  })}
                </span>
                <span>
                  {holding.price === undefined ? "—" : money(holding.price)}
                </span>
                <span>
                  <strong>{money(holding.value)}</strong>
                </span>
                <span
                  className={
                    (holding.gain ?? 0) >= 0 ? "positive-text" : "negative-text"
                  }
                >
                  {holding.gain === undefined
                    ? "—"
                    : `${holding.gain >= 0 ? "+" : "−"}${money(Math.abs(holding.gain))}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <BriefcaseBusiness size={22} />
            <strong>No holdings imported for this view</strong>
            <p>
              {investmentView === "retirement"
                ? "The current Bank of America connection supplies the plan balance, but not its fund positions."
                : "Connect a supported brokerage to import positions."}
            </p>
          </div>
        )}
      </article>
      <article className="card investment-activity-card">
        <div className="card-head">
          <div>
            <span className="label">ACTIVITY</span>
            <h3>
              {investmentView === "retirement"
                ? "Retirement contributions & activity"
                : "Investment money flow"}
            </h3>
          </div>
          <small>Buys, sells, dividends, contributions, and withdrawals</small>
        </div>
        {visibleActivities.length ? (
          <div className="investment-activity-list">
            {visibleActivities.map((activity) => (
              <div className="investment-activity" key={activity.id}>
                <span className="activity-icon">
                  <ArrowRight size={15} />
                </span>
                <div>
                  <strong>{activity.name}</strong>
                  <small>
                    {new Date(activity.date).toLocaleDateString()} ·{" "}
                    {activity.accountName} ·{" "}
                    {[activity.type, activity.subtype]
                      .filter(Boolean)
                      .join(" / ")
                      .replaceAll("_", " ")}
                  </small>
                </div>
                <span>
                  {activity.ticker ?? activity.securityName ?? "Cash"}
                </span>
                <b className={activity.amount < 0 ? "positive-text" : ""}>
                  {activity.amount < 0 ? "+" : "−"}
                  {money(Math.abs(activity.amount))}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <strong>No activity available for this view</strong>
            <p>
              {investmentView === "retirement"
                ? "Contribution history will appear if a retirement provider exposes it through Plaid."
                : "Sync after connecting an investment account."}
            </p>
          </div>
        )}
      </article>
    </>
  );
}

export function AnalyticsPage({
  metrics,
  accounts,
  transactions,
  investments,
}: {
  metrics: DashboardMetrics;
  accounts: Account[];
  transactions: Transaction[];
  investments: InvestmentDashboard;
}) {
  const topCategory = metrics.spendingByCategory[0];
  const isRetirement = (account: Account) =>
    /401\s*\(?k\)?|403\s*\(?b\)?|457|retirement|ira|pension/i.test(
      account.name,
    );
  const investmentAccounts = accounts.filter(
    (account) => account.kind === "investment",
  );
  const retirementBalance = investmentAccounts
    .filter(isRetirement)
    .reduce((sum, account) => sum + account.balance, 0);
  const brokerageAccounts = investmentAccounts.filter(
    (account) => !isRetirement(account),
  );
  const brokerageBalance = brokerageAccounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  const brokerageIds = new Set(brokerageAccounts.map((account) => account.id));
  const brokerageGain = investments.holdings
    .filter((holding) => brokerageIds.has(holding.accountId))
    .reduce((sum, holding) => sum + (holding.gain ?? 0), 0);
  const trackedSince = metrics.trackingStartedAt
    ? new Date(metrics.trackingStartedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      })
    : null;
  const sourceRows = [
    { label: "Liquid cash", value: metrics.liquid, color: "#284c40" },
    { label: "Brokerage", value: brokerageBalance, color: "#7088a3" },
    {
      label: "401(k) & retirement",
      value: retirementBalance,
      color: "#ab7650",
    },
    ...(metrics.storedValue
      ? [
          {
            label: "Stored value",
            value: metrics.storedValue,
            color: "#b6a171",
          },
        ]
      : []),
  ];
  return (
    <>
      <PageHeader
        title="Analytics"
        text={`Cash-flow analytics${trackedSince ? ` since ${trackedSince}` : ""}; investment history remains available separately.`}
      />
      <section className="analytics-kpis">
        <article>
          <span>Tracked transactions</span>
          <strong>{transactions.length}</strong>
          <small>Everyday activity since the start date</small>
        </article>
        <article>
          <span>Net cash flow</span>
          <strong
            className={
              metrics.netChange >= 0 ? "positive-text" : "negative-text"
            }
          >
            {metrics.netChange >= 0 ? "+" : "−"}
            {money(Math.abs(metrics.netChange))}
          </strong>
          <small>
            {money(metrics.moneyIn)} in · {money(metrics.moneyOut)} out
          </small>
        </article>
        <article>
          <span>Total investments</span>
          <strong>{money(investments.totalValue)}</strong>
          <small>
            {money(brokerageBalance)} brokerage · {money(retirementBalance)}{" "}
            retirement
          </small>
        </article>
        <article>
          <span>Brokerage gain</span>
          <strong
            className={brokerageGain >= 0 ? "positive-text" : "negative-text"}
          >
            {brokerageGain >= 0 ? "+" : "−"}
            {money(Math.abs(brokerageGain))}
          </strong>
          <small>Based only on holdings with reported cost basis</small>
        </article>
      </section>
      <section className="insight">
        <span>
          <Sparkles size={19} />
        </span>
        <div>
          <strong>Current-month insight</strong>
          <p>
            {topCategory
              ? `${topCategory.name} is your largest spending category at ${money(topCategory.value)}.`
              : `No everyday spending has been recorded${trackedSince ? ` since ${trackedSince}` : " yet"}.`}
          </p>
        </div>
        <button>
          Explore <ChevronRight size={15} />
        </button>
      </section>
      <div className="dashboard-grid">
        <article className="card chart-card wide">
          <div className="card-head">
            <div>
              <span className="label">Growth</span>
              <h3>Net worth over time</h3>
            </div>
            <button className="period">Balance history</button>
          </div>
          <NetWorthChart data={metrics.netWorthHistory} />
        </article>
        <article className="card chart-card">
          <div className="card-head">
            <div>
              <span className="label">Distribution</span>
              <h3>Spending mix</h3>
            </div>
          </div>
          {metrics.spendingByCategory.length ? (
            <SpendingChart data={metrics.spendingByCategory} />
          ) : (
            <div className="empty-state chart-empty">
              <strong>No spending data yet</strong>
              <p>
                Transactions dated on or after the tracking start will build
                this chart.
              </p>
            </div>
          )}
        </article>
      </div>
      <div className="dashboard-grid analytics-lower-grid">
        <article className="card source-analysis">
          <div className="card-head">
            <div>
              <span className="label">NET WORTH</span>
              <h3>Where your money lives</h3>
            </div>
            <strong>{money(metrics.netWorth)}</strong>
          </div>
          <div className="source-bars">
            {sourceRows.map((source) => (
              <div key={source.label}>
                <span>
                  {source.label}
                  <b>{money(source.value)}</b>
                </span>
                <i>
                  <em
                    style={{
                      width: `${metrics.netWorth ? Math.max(1, (source.value / metrics.netWorth) * 100) : 0}%`,
                      background: source.color,
                    }}
                  />
                </i>
              </div>
            ))}
          </div>
        </article>
        <article className="card chart-card">
          <div className="card-head">
            <div>
              <span className="label">INVESTMENTS</span>
              <h3>Portfolio allocation</h3>
            </div>
          </div>
          <AllocationChart data={investments.allocation} />
        </article>
      </div>
      <FinanceAskCard />
    </>
  );
}

export function BudgetsPage() {
  return (
    <>
      <PageHeader
        title="Budgets"
        text="A flexible monthly plan for the things that matter."
        action="New budget"
      />
      <article className="card blank-slate">
        <span className="blank-icon">$</span>
        <h2>No budgets yet</h2>
        <p>
          Your monthly plan will appear here after you create the first budget.
        </p>
      </article>
    </>
  );
}

export function ReviewPage({
  metrics,
  transactions,
  accounts,
  receipts,
  categories,
  onReview,
  onUploadReceipt,
  onUpdated,
}: {
  metrics: DashboardMetrics;
  transactions: Transaction[];
  accounts: Account[];
  receipts: ReceiptData[];
  categories: import("@/lib/types").CategoryOption[];
  onReview: (transaction: Transaction) => void;
  onUploadReceipt: () => void;
  onUpdated: () => void;
}) {
  const [classifying, setClassifying] = useState<string | null>(null);
  const [processingReceipt, setProcessingReceipt] = useState<string | null>(
    null,
  );
  const [classificationError, setClassificationError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "all" | "transactions" | "receipts" | "accounts" | "dismissed"
  >("all");
  const [dismissedQuery, setDismissedQuery] = useState("");
  const [bulkDismissing, setBulkDismissing] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptData | null>(
    null,
  );
  const [previewingReceipt, setPreviewingReceipt] =
    useState<ReceiptData | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<
    Record<string, string>
  >({});
  const [locationTarget, setLocationTarget] = useState<{
    entityType: "transaction" | "receipt";
    entityId: string;
    merchant: string;
    query: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const reviewTransactions = transactions.filter(
    (transaction) =>
      transaction.status === "needs-review" || transaction.status === "pending",
  );
  const reviewReceipts = receipts.filter(
    (receipt) =>
      receipt.status !== "confirmed" && receipt.status !== "rejected",
  );
  const dismissedReceipts = receipts.filter(
    (receipt) =>
      receipt.status === "rejected" &&
      `${receipt.merchant ?? ""} ${receipt.filename} ${receipt.source}`
        .toLowerCase()
        .includes(dismissedQuery.toLowerCase()),
  );
  const staleAccounts = accounts.filter((account) => account.stale);
  const itemCount =
    reviewTransactions.length + reviewReceipts.length + staleAccounts.length;
  const visibleTransactions =
    activeTab === "all" || activeTab === "transactions"
      ? reviewTransactions
      : [];
  const visibleReceipts =
    activeTab === "all" || activeTab === "receipts" ? reviewReceipts : [];
  const visibleDismissed = activeTab === "dismissed" ? dismissedReceipts : [];
  const visibleAccounts =
    activeTab === "all" || activeTab === "accounts" ? staleAccounts : [];
  const visibleCount =
    visibleTransactions.length +
    visibleReceipts.length +
    visibleDismissed.length +
    visibleAccounts.length;
  async function classify(id: string) {
    setClassifying(id);
    setClassificationError("");
    const response = await fetch(`/api/transactions/${id}/classify`, {
      method: "POST",
    });
    const result = await response.json();
    setClassifying(null);
    if (!response.ok) {
      setClassificationError(result.error ?? "AI classification failed.");
      return;
    }
    onUpdated();
  }
  async function receiptAction(
    id: string,
    action: "analyze" | "confirm" | "reject" | "dismiss" | "restore" | "link",
  ) {
    setProcessingReceipt(id);
    setClassificationError("");
    const response = await fetch(
      action === "analyze"
        ? `/api/receipts/${id}/analyze`
        : `/api/receipts/${id}`,
      {
        method: action === "analyze" ? "POST" : "PATCH",
        headers:
          action === "analyze"
            ? undefined
            : { "Content-Type": "application/json" },
        body:
          action === "analyze"
            ? undefined
            : JSON.stringify({ action, transactionId: selectedMatches[id] }),
      },
    );
    const result = await response.json();
    setProcessingReceipt(null);
    if (!response.ok) {
      setClassificationError(result.error ?? "Receipt action failed.");
      return;
    }
    onUpdated();
  }
  async function dismissAllReceipts() {
    if (!reviewReceipts.length) return;
    if (
      !window.confirm(
        `Dismiss all ${reviewReceipts.length} receipts currently awaiting review? You can restore them from the Dismissed tab.`,
      )
    )
      return;
    setBulkDismissing(true);
    setClassificationError("");
    const response = await fetch("/api/receipts/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "dismiss",
        ids: reviewReceipts.map((receipt) => receipt.id),
      }),
    });
    const result = await response.json();
    setBulkDismissing(false);
    if (!response.ok) {
      setClassificationError(result.error ?? "Could not dismiss receipts.");
      return;
    }
    onUpdated();
  }
  return (
    <>
      <PageHeader
        title="Needs review"
        text="Confirm imported transactions, receipt details, and proposed matches."
        action="Upload receipt"
        onAction={onUploadReceipt}
      />
      <div className="review-layout">
        <div className="review-queue">
          <div className="queue-tabs">
            <button
              className={activeTab === "all" ? "active" : ""}
              onClick={() => setActiveTab("all")}
            >
              All <b>{itemCount}</b>
            </button>
            <button
              className={activeTab === "transactions" ? "active" : ""}
              onClick={() => setActiveTab("transactions")}
            >
              Transactions <b>{reviewTransactions.length}</b>
            </button>
            <button
              className={activeTab === "receipts" ? "active" : ""}
              onClick={() => setActiveTab("receipts")}
            >
              Receipts <b>{reviewReceipts.length}</b>
            </button>
            <button
              className={activeTab === "accounts" ? "active" : ""}
              onClick={() => setActiveTab("accounts")}
            >
              Accounts <b>{staleAccounts.length}</b>
            </button>
            <button
              className={activeTab === "dismissed" ? "active" : ""}
              onClick={() => setActiveTab("dismissed")}
            >
              Dismissed{" "}
              <b>{receipts.filter((r) => r.status === "rejected").length}</b>
            </button>
          </div>
          {(activeTab === "all" || activeTab === "receipts") &&
            reviewReceipts.length > 0 && (
              <div className="receipt-queue-tools">
                <span>
                  {reviewReceipts.length} receipt
                  {reviewReceipts.length === 1 ? "" : "s"} awaiting review
                </span>
                <button
                  className="button secondary"
                  disabled={bulkDismissing}
                  onClick={dismissAllReceipts}
                >
                  {bulkDismissing ? "Dismissing…" : "Dismiss all receipts"}
                </button>
              </div>
            )}
          {activeTab === "dismissed" && (
            <div className="dismissed-receipt-search search">
              <Search size={16} />
              <input
                value={dismissedQuery}
                onChange={(event) => setDismissedQuery(event.target.value)}
                placeholder="Search dismissed emails and receipt files"
                aria-label="Search dismissed receipts"
              />
            </div>
          )}
          {classificationError && (
            <p className="review-error">{classificationError}</p>
          )}
          {visibleReceipts.map((receipt) => (
            <article className="review-item receipt-review" key={receipt.id}>
              <span className="review-type medium">
                <Sparkles size={18} />
              </span>
              <div>
                <small>
                  Receipt · {receipt.source.toLowerCase().replaceAll("_", " ")}{" "}
                  · {receipt.status}
                  {receipt.purchaseChannel &&
                    ` · ${receipt.purchaseChannel.toLowerCase().replaceAll("_", " ")}`}
                </small>
                <strong>{receipt.merchant ?? receipt.filename}</strong>
                <p>
                  {receipt.total !== undefined
                    ? money(receipt.total)
                    : "Not analyzed"}
                  {receipt.matchedTransaction
                    ? ` · Possible match: ${receipt.matchedTransaction}`
                    : ""}
                </p>
                {[
                  receipt.diningCuisine,
                  receipt.diningVenueType,
                  receipt.diningServiceStyle,
                ].some((value) => value && value !== "UNKNOWN") && (
                  <div className="dining-facet-tags">
                    {[
                      receipt.diningCuisine,
                      receipt.diningVenueType,
                      receipt.diningServiceStyle,
                    ]
                      .filter((value): value is string =>
                        Boolean(value && value !== "UNKNOWN"),
                      )
                      .map((value) => (
                        <span key={value}>{diningLabel(value)}</span>
                      ))}
                  </div>
                )}
                {receipt.items.some((item) => item.price > 0) && (
                  <div className="receipt-items">
                    {receipt.items
                      .filter((item) => item.price > 0)
                      .map((item) => (
                        <span key={item.id}>
                          {item.name}
                          <b>{money(item.price)}</b>
                          <small>{item.category}</small>
                        </span>
                      ))}
                  </div>
                )}
                {receipt.items.some((item) => item.price === 0) && (
                  <small className="zero-items-note">
                    {receipt.items.filter((item) => item.price === 0).length}{" "}
                    no-cost modifier
                    {receipt.items.filter((item) => item.price === 0).length ===
                    1
                      ? ""
                      : "s"}{" "}
                    hidden · available in Edit receipt
                  </small>
                )}
              </div>
              <div className="review-actions">
                <button
                  className="button secondary"
                  onClick={() => setPreviewingReceipt(receipt)}
                >
                  <Eye size={13} />
                  View receipt
                </button>
                {receipt.confidence === undefined ? (
                  <button
                    className="button secondary"
                    disabled={processingReceipt === receipt.id}
                    onClick={() => receiptAction(receipt.id, "analyze")}
                  >
                    <Sparkles size={13} />
                    {processingReceipt === receipt.id
                      ? "Analyzing…"
                      : "Analyze receipt"}
                  </button>
                ) : (
                  <button
                    className="button secondary"
                    disabled={processingReceipt === receipt.id}
                    onClick={() => setEditingReceipt(receipt)}
                  >
                    Edit receipt
                  </button>
                )}
                {receipt.confidence !== undefined && !receipt.transactionId && (
                  <>
                    <select
                      className="receipt-match-select"
                      aria-label="Choose transaction"
                      value={selectedMatches[receipt.id] ?? ""}
                      onChange={(event) =>
                        setSelectedMatches((current) => ({
                          ...current,
                          [receipt.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Link to transaction…</option>
                      {transactions
                        .filter(
                          (transaction) =>
                            transaction.amount < 0 && !transaction.receiptId,
                        )
                        .map((transaction) => (
                          <option value={transaction.id} key={transaction.id}>
                            {transaction.date} · {transaction.merchant} ·{" "}
                            {money(Math.abs(transaction.amount))}
                          </option>
                        ))}
                    </select>
                    <button
                      className="button secondary"
                      disabled={
                        processingReceipt === receipt.id ||
                        !selectedMatches[receipt.id]
                      }
                      onClick={() => receiptAction(receipt.id, "link")}
                    >
                      Link
                    </button>
                  </>
                )}
                {receipt.mapsUrl ? (
                  <a
                    className="button secondary"
                    href={receipt.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={13} />
                    Open map
                  </a>
                ) : receipt.purchaseChannel?.toUpperCase() === "ONLINE" ? (
                  <button
                    className="button secondary online-purchase-badge"
                    onClick={() =>
                      setLocationTarget({
                        entityType: "receipt",
                        entityId: receipt.id,
                        merchant: receipt.merchant ?? receipt.filename,
                        query: receipt.merchant ?? receipt.filename,
                      })
                    }
                  >
                    <Globe2 size={13} />
                    Online purchase
                  </button>
                ) : (
                  <button
                    className="button secondary"
                    onClick={() =>
                      setLocationTarget({
                        entityType: "receipt",
                        entityId: receipt.id,
                        merchant: receipt.merchant ?? receipt.filename,
                        query: [
                          receipt.merchant,
                          receipt.locationAddress,
                          receipt.locationCity,
                          receipt.locationRegion,
                          receipt.locationPostalCode,
                        ]
                          .filter(Boolean)
                          .join(" "),
                        latitude: receipt.latitude,
                        longitude: receipt.longitude,
                      })
                    }
                  >
                    <MapPin size={13} />
                    Find location
                  </button>
                )}
                <button
                  className="button secondary"
                  disabled={processingReceipt === receipt.id}
                  onClick={() => receiptAction(receipt.id, "dismiss")}
                >
                  Dismiss
                </button>
                {receipt.transactionId &&
                  receipt.status === "potential match" && (
                    <>
                      <button
                        className="button secondary"
                        onClick={() => receiptAction(receipt.id, "reject")}
                      >
                        Reject match
                      </button>
                      <button
                        className="button"
                        onClick={() => receiptAction(receipt.id, "confirm")}
                      >
                        Confirm match
                      </button>
                    </>
                  )}
              </div>
            </article>
          ))}
          {visibleDismissed.map((receipt) => (
            <article
              className="review-item receipt-review dismissed-receipt"
              key={receipt.id}
            >
              <span className="review-type medium">
                <ArchiveRestore size={18} />
              </span>
              <div>
                <small>
                  Dismissed ·{" "}
                  {receipt.source.toLowerCase().replaceAll("_", " ")}
                </small>
                <strong>{receipt.merchant ?? receipt.filename}</strong>
                <p>
                  {receipt.total !== undefined
                    ? money(receipt.total)
                    : receipt.filename}
                </p>
              </div>
              <div className="review-actions">
                <button
                  className="button secondary"
                  onClick={() => setPreviewingReceipt(receipt)}
                >
                  <Eye size={13} />
                  View source
                </button>
                <button
                  className="button"
                  disabled={processingReceipt === receipt.id}
                  onClick={() => receiptAction(receipt.id, "restore")}
                >
                  <ArchiveRestore size={13} />
                  {processingReceipt === receipt.id ? "Restoring…" : "Restore"}
                </button>
              </div>
            </article>
          ))}
          {visibleTransactions.map((transaction) => (
            <article className="review-item" key={transaction.id}>
              <span className="review-type high">
                <CircleAlert size={18} />
              </span>
              <div>
                <small>Transaction to confirm</small>
                <strong>{transaction.merchant}</strong>
                <p>
                  {money(Math.abs(transaction.amount))} · Suggested:{" "}
                  {transaction.category}
                </p>
                {[
                  transaction.diningCuisine,
                  transaction.diningVenueType,
                  transaction.diningServiceStyle,
                ].some((value) => value && value !== "UNKNOWN") && (
                  <div className="dining-facet-tags">
                    {[
                      transaction.diningCuisine,
                      transaction.diningVenueType,
                      transaction.diningServiceStyle,
                    ]
                      .filter((value): value is string =>
                        Boolean(value && value !== "UNKNOWN"),
                      )
                      .map((value) => (
                        <span key={value}>{diningLabel(value)}</span>
                      ))}
                  </div>
                )}
              </div>
              <div className="review-actions">
                {transaction.mapsUrl ? (
                  <a
                    className="button secondary"
                    href={transaction.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={13} />
                    Open map
                  </a>
                ) : transaction.paymentChannel?.toUpperCase() === "ONLINE" ? (
                  <button
                    className="button secondary online-purchase-badge"
                    onClick={() =>
                      setLocationTarget({
                        entityType: "transaction",
                        entityId: transaction.id,
                        merchant: transaction.merchant,
                        query: transaction.merchant,
                      })
                    }
                  >
                    <Globe2 size={13} />
                    Online purchase
                  </button>
                ) : (
                  <button
                    className="button secondary"
                    onClick={() =>
                      setLocationTarget({
                        entityType: "transaction",
                        entityId: transaction.id,
                        merchant: transaction.merchant,
                        query: [transaction.merchant, transaction.location]
                          .filter(Boolean)
                          .join(" "),
                        latitude: transaction.latitude,
                        longitude: transaction.longitude,
                      })
                    }
                  >
                    <MapPin size={13} />
                    Find location
                  </button>
                )}
                <button
                  className="button secondary"
                  disabled={classifying === transaction.id}
                  onClick={() => classify(transaction.id)}
                >
                  <Sparkles size={13} />
                  {classifying === transaction.id
                    ? "Classifying…"
                    : "Suggest with AI"}
                </button>
                <button
                  className="button"
                  onClick={() => onReview(transaction)}
                >
                  Review & edit
                </button>
              </div>
            </article>
          ))}
          {visibleAccounts.map((account) => (
            <article className="review-item" key={account.id}>
              <span className="review-type medium">
                <CircleAlert size={18} />
              </span>
              <div>
                <small>Stale balance</small>
                <strong>{account.name}</strong>
                <p>This account has not been synchronized in over 30 days.</p>
              </div>
            </article>
          ))}
          {!visibleCount && (
            <div className="blank-slate compact">
              <h2>Nothing in this view</h2>
              <p>
                {activeTab === "all"
                  ? "New transactions and receipts will appear here for your confirmation."
                  : `No ${activeTab} currently need review.`}
              </p>
            </div>
          )}
        </div>
        <aside className="card reconciliation">
          <span className="label">Current month</span>
          <h3>Reconciliation</h3>
          <div className="score">
            <strong>{metrics.reconciliationRate.toFixed(1)}%</strong>
            <span>fully explained</span>
          </div>
          <div className="progress">
            <i style={{ width: `${metrics.reconciliationRate}%` }} />
          </div>
          <dl>
            <div>
              <dt>Fully explained</dt>
              <dd>{money(metrics.reconciledAmount)}</dd>
            </div>
            <div>
              <dt>Needs details</dt>
              <dd>{money(metrics.needsDetailsAmount)}</dd>
            </div>
            <div>
              <dt>Total spending</dt>
              <dd>{money(metrics.moneyOut)}</dd>
            </div>
          </dl>
        </aside>
      </div>
      <ReceiptEditModal
        receipt={editingReceipt}
        categories={categories}
        onClose={() => setEditingReceipt(null)}
        onSaved={() => {
          setEditingReceipt(null);
          onUpdated();
        }}
      />
      <ReceiptPreviewModal
        receipt={previewingReceipt}
        onClose={() => setPreviewingReceipt(null)}
      />
      <LocationLookupModal
        key={
          locationTarget
            ? `${locationTarget.entityType}-${locationTarget.entityId}`
            : "closed"
        }
        target={locationTarget}
        onClose={() => setLocationTarget(null)}
        onConfirmed={() => {
          setLocationTarget(null);
          onUpdated();
        }}
      />
    </>
  );
}

function DriveReceiptSource({
  connection,
  onUpdated,
}: {
  connection?: ReceiptConnectionData;
  onUpdated: () => void;
}) {
  const [folder, setFolder] = useState("");
  const [working, setWorking] = useState<"folder" | "sync" | null>(null);
  const [message, setMessage] = useState("");
  async function saveFolder(event: FormEvent) {
    event.preventDefault();
    setWorking("folder");
    setMessage("");
    const response = await fetch("/api/integrations/drive/folder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    });
    const result = await response.json();
    setWorking(null);
    if (!response.ok) {
      setMessage(result.error ?? "Could not save the Drive folder.");
      return;
    }
    setFolder("");
    setMessage(`Using “${result.folderName}” for receipts.`);
    onUpdated();
  }
  async function scan() {
    setWorking("sync");
    setMessage("");
    const response = await fetch("/api/integrations/drive/sync", {
      method: "POST",
    });
    const result = await response.json();
    setWorking(null);
    if (!response.ok) {
      setMessage(result.error ?? "Google Drive scan failed.");
      return;
    }
    setMessage(
      result.imported
        ? `${result.imported} new receipt${result.imported === 1 ? "" : "s"} imported from “${result.folderName}”${result.unsupported ? `; ${result.unsupported} unsupported file${result.unsupported === 1 ? " was" : "s were"} skipped` : ""}.`
        : result.unsupported
          ? `No supported receipts found in “${result.folderName}”; ${result.unsupported} unsupported file${result.unsupported === 1 ? " was" : "s were"} skipped.`
          : `No new receipts found in “${result.folderName}”.`,
    );
    onUpdated();
  }
  if (!connection)
    return (
      <div className="setting-row">
        <span className="institution-mark drive-mark">D</span>
        <div>
          <strong>Google Drive</strong>
          <small>Scan one selected folder for receipt images and PDFs</small>
        </div>
        <a className="button" href="/api/integrations/drive/connect">
          Connect Drive
        </a>
      </div>
    );
  return (
    <>
      <div className="setting-row drive-setting">
        <span className="institution-mark drive-mark">D</span>
        <div>
          <strong>Google Drive</strong>
          <small>
            {connection.folderName
              ? `${connection.folderName} · ${connection.status.toLowerCase()}`
              : `${connection.displayName} · choose a folder`}
          </small>
        </div>
        {connection.folderName && (
          <button
            className="button secondary"
            disabled={Boolean(working)}
            onClick={scan}
          >
            {working === "sync" ? "Scanning…" : "Scan folder"}
          </button>
        )}
      </div>
      <form className="drive-folder-form" onSubmit={saveFolder}>
        <input
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
          placeholder="Paste Google Drive folder link"
          required
        />
        <button className="button secondary" disabled={Boolean(working)}>
          {working === "folder"
            ? "Checking…"
            : connection.folderName
              ? "Change folder"
              : "Use folder"}
        </button>
      </form>
      {message && <p className="connection-status">{message}</p>}
    </>
  );
}

export function SettingsPage({
  accounts,
  plaidConnections,
  receiptConnections,
  onUpdated,
}: {
  accounts: Account[];
  plaidConnections: PlaidConnectionData[];
  receiptConnections: ReceiptConnectionData[];
  onUpdated: () => void;
}) {
  const [syncing, setSyncing] = useState<"targeted" | "recent" | "full" | null>(
    null,
  );
  const [syncMessage, setSyncMessage] = useState("");
  const providers = [
    ...new Map(
      accounts.map((account) => [account.institution, account]),
    ).values(),
  ];
  const gmail = receiptConnections.find(
    (connection) => connection.provider === "GMAIL",
  );
  const drive = receiptConnections.find(
    (connection) => connection.provider === "GOOGLE_DRIVE",
  );
  async function scanGmail(mode: "targeted" | "recent" | "full" = "targeted") {
    setSyncing(mode);
    setSyncMessage("");
    const response = await fetch("/api/integrations/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode:
          mode === "full"
            ? "full_90_days"
            : mode === "recent"
              ? "last_5_days"
              : "targeted",
      }),
    });
    const result = await response.json();
    setSyncing(null);
    if (!response.ok) {
      setSyncMessage(result.error ?? "Gmail scan failed.");
      return;
    }
    if (mode === "targeted" && result.imported === 0) {
      const searches = (result.transactionSearches ?? []) as Array<{
        merchant: string;
        transactionDate: string;
        startDate: string;
        endDate: string;
      }>;
      if (searches.length === 0)
        setSyncMessage(
          "No transactions are currently waiting for a receipt scan.",
        );
      else if (searches.length === 1) {
        const search = searches[0];
        setSyncMessage(
          `No receipt found for ${search.merchant} on ${new Date(`${search.transactionDate}T12:00:00Z`).toLocaleDateString()}. Gmail was searched from ${new Date(`${search.startDate}T12:00:00Z`).toLocaleDateString()} through ${new Date(`${search.endDate}T12:00:00Z`).toLocaleDateString()}.`,
        );
      } else
        setSyncMessage(
          `No receipts found for ${searches.length} transactions in their date windows.`,
        );
    } else
      setSyncMessage(
        `${result.imported} new receipt${result.imported === 1 ? "" : "s"} imported with the ${mode === "full" ? "90-day" : mode === "recent" ? "5-day" : "transaction-targeted"} search.`,
      );
    onUpdated();
  }
  return (
    <>
      <PageHeader
        title="Settings"
        text="Manage your workspace, connections, and privacy."
      />
      <article className="card settings-card">
        <h3>Financial connections</h3>
        <p>Control where Ledgerly receives financial information.</p>
        {plaidConnections.length || providers.length ? (
          <>
            {plaidConnections.map((connection) => (
              <div className="setting-row" key={connection.id}>
                <span className="institution-mark">
                  {connection.institution[0]}
                </span>
                <div>
                  <strong>{connection.institution}</strong>
                  <small>
                    {connection.accountCount} account
                    {connection.accountCount === 1 ? "" : "s"} ·{" "}
                    {connection.products
                      .filter((product) => !product.endsWith("_UNSUPPORTED"))
                      .map((product) => product.toLowerCase())
                      .join(" + ") || "Plaid connected"}
                    {connection.newAccountsAvailable
                      ? " · new account available"
                      : connection.needsAttention
                        ? " · action required"
                        : ""}
                  </small>
                </div>
                <PlaidConnectButton
                  mode="update"
                  connectionId={connection.id}
                  addInvestments
                  label={
                    connection.newAccountsAvailable
                      ? "Add new account"
                      : "Manage accounts"
                  }
                  onComplete={onUpdated}
                />
              </div>
            ))}
            {providers
              .filter((account) => !account.automatic)
              .map((account) => (
                <div
                  className="setting-row"
                  key={`manual-${account.institution}`}
                >
                  <span className="institution-mark">
                    {account.institution[0]}
                  </span>
                  <div>
                    <strong>{account.institution}</strong>
                    <small>Manually tracked</small>
                  </div>
                </div>
              ))}
          </>
        ) : (
          <div className="blank-slate compact">
            <h2>No connections</h2>
            <p>Connect a bank from Overview to get started.</p>
          </div>
        )}
        <div className="connection-actions settings-connect-actions">
          <PlaidConnectButton mode="bank" onComplete={onUpdated} />
          <PlaidConnectButton mode="investment" onComplete={onUpdated} />
        </div>
      </article>
      <article className="card settings-card receipt-connections">
        <h3>Receipt sources</h3>
        <p>Read-only sources that can discover receipt emails and files.</p>
        <div className="setting-row">
          <span className="institution-mark gmail-mark">G</span>
          <div>
            <strong>Gmail</strong>
            <small>
              {gmail
                ? `${gmail.displayName} · ${gmail.status.toLowerCase()}`
                : "Read-only receipt email scanning"}
            </small>
          </div>
          {gmail ? (
            <div className="connection-actions">
              <button
                className="button secondary"
                disabled={Boolean(syncing)}
                onClick={() => scanGmail("targeted")}
              >
                {syncing === "targeted" ? "Scanning…" : "Scan transactions"}
              </button>
              <button
                className="button secondary"
                disabled={Boolean(syncing)}
                onClick={() => scanGmail("recent")}
              >
                {syncing === "recent" ? "Searching…" : "Search last 5 days"}
              </button>
              <button
                className="button secondary"
                disabled={Boolean(syncing)}
                onClick={() => scanGmail("full")}
              >
                {syncing === "full" ? "Searching…" : "Search last 90 days"}
              </button>
            </div>
          ) : (
            <a className="button" href="/api/integrations/gmail/connect">
              Connect Gmail
            </a>
          )}
        </div>
        {syncMessage && <p className="connection-status">{syncMessage}</p>}
        <DriveReceiptSource connection={drive} onUpdated={onUpdated} />
      </article>
    </>
  );
}
