import { ArrowDownRight, ArrowUpRight, ChevronRight, Clock3, Plus, Wallet } from "lucide-react";
import type { Account, DashboardMetrics, Transaction } from "@/lib/types";
import { NetWorthChart, SpendingChart } from "./charts";
import { TransactionList } from "./transaction-list";
import { PlaidConnectButton } from "./plaid-connect-button";
import { PlaidSyncButton } from "./plaid-sync-button";

const currency = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function Overview({ onNavigate, onAddAccount, onBankConnected, accounts, transactions, metrics }: { onNavigate: (page: string) => void; onAddAccount: () => void; onBankConnected: () => void; accounts: Account[]; transactions: Transaction[]; metrics: DashboardMetrics }) {
  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  const month = new Date().toLocaleDateString("en-US", { month:"long" });
  const trackingSince = metrics.trackingStartedAt ? new Date(metrics.trackingStartedAt).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric", timeZone:"America/New_York" }) : null;
  return <>
    <header className="topbar"><div><p className="eyebrow">{today}</p><h1>Good evening, Abhinn.</h1><p>Here’s the complete picture of your money.{trackingSince && <span className="tracking-since">Tracking since {trackingSince}</span>}</p></div><div className="top-actions"><span className="sync"><i /> Database connected</span><PlaidSyncButton onComplete={onBankConnected}/><PlaidConnectButton onComplete={onBankConnected}/><button className="button" onClick={onAddAccount}><Plus size={16}/> Add account</button></div></header>

    <section className="summary-grid">
      <div className="hero-balance"><div><span className="label">Total net worth <span className="live-dot" /></span><h2>{currency(metrics.netWorth)}</h2><p><span className="up"><ArrowUpRight size={14}/></span><span>{metrics.netChange >= 0 ? "+" : ""}{currency(metrics.netChange)} this month</span></p></div><div className="mini-breakdown"><span>Liquid cash <b>{currency(metrics.liquid)}</b></span><span>Investments <b>{currency(metrics.investments)}</b></span><span>Stored value <b>{currency(metrics.storedValue)}</b></span></div></div>
      <div className="metric-card"><span className="metric-icon green"><ArrowDownRight size={18}/></span><span className="label">Money in</span><h3>{currency(metrics.moneyIn)}</h3><p>{month}</p></div>
      <div className="metric-card"><span className="metric-icon tan"><ArrowUpRight size={18}/></span><span className="label">Money out</span><h3>{currency(metrics.moneyOut)}</h3><p>{month}</p></div>
      <div className="metric-card"><span className="metric-icon gray"><Wallet size={18}/></span><span className="label">Net cash flow</span><h3>{currency(metrics.netChange)}</h3><p>{metrics.moneyIn ? `${Math.round(metrics.netChange / metrics.moneyIn * 100)}% of income` : "No income recorded"}</p></div>
    </section>

    <section className="dashboard-grid">
      <article className="card chart-card wide"><div className="card-head"><div><span className="label">Net worth</span><h3>{currency(metrics.netWorth)} <small>{metrics.netChange >= 0 ? "+" : ""}{currency(metrics.netChange)}</small></h3></div><button className="period">Balance history</button></div><NetWorthChart data={metrics.netWorthHistory}/></article>
      <article className="card chart-card"><div className="card-head"><div><span className="label">Spending</span><h3>By category</h3></div><button className="link" onClick={() => onNavigate("Analytics")}>Details <ChevronRight size={14}/></button></div><SpendingChart data={metrics.spendingByCategory}/></article>
    </section>

    <section className="dashboard-grid lower">
      <article className="card wide"><div className="card-head"><div><span className="label">Recent activity</span><h3>Transactions</h3></div><button className="link" onClick={() => onNavigate("Transactions")}>View all <ChevronRight size={14}/></button></div><TransactionList transactions={transactions} accounts={accounts}/></article>
      <aside className="stack">
        <article className="card budget-card"><div className="card-head"><div><span className="label">Monthly plan</span><h3>Budgets</h3></div><button className="link" onClick={() => onNavigate("Budgets")}>Manage</button></div><div className="empty-mini"><strong>No budgets yet</strong><p>Create a budget when you are ready to plan this month.</p></div></article>
        <article className="review-card"><span className="review-icon"><Clock3 size={20}/></span><div><strong>{metrics.reviewCount ? `${metrics.reviewCount} ${metrics.reviewCount === 1 ? "item" : "items"} need attention` : "Everything is reviewed"}</strong><p>{metrics.reviewCount ? "Open the review queue to resolve exceptions." : "No unresolved ledger items right now."}</p></div><button onClick={() => onNavigate("Needs review")}><ChevronRight size={17}/></button></article>
      </aside>
    </section>
  </>;
}
