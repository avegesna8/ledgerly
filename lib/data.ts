import type { Account, Budget, Transaction } from "./types";

export const accounts: Account[] = [
  { id: "boa-checking", name: "Primary Checking", institution: "Bank of America", kind: "checking", balance: 8424.62, change: 4.2, lastFour: "2184", color: "#22463b", automatic: true },
  { id: "boa-savings", name: "Emergency Savings", institution: "Bank of America", kind: "savings", balance: 12850.0, change: 1.8, lastFour: "8821", color: "#647c72", automatic: true },
  { id: "robinhood", name: "Individual Brokerage", institution: "Robinhood", kind: "investment", balance: 19420.36, change: 8.4, lastFour: "4690", color: "#9b795d", automatic: false },
  { id: "venmo", name: "Venmo Balance", institution: "Venmo", kind: "wallet", balance: 386.4, change: -2.1, color: "#7088a3", automatic: false },
  { id: "cash", name: "Wallet Cash", institution: "Manual", kind: "cash", balance: 184.0, change: 0, color: "#b19b6b", automatic: false },
  { id: "openai-credit", name: "API Credits", institution: "OpenAI", kind: "credit", balance: 72.18, change: -12.5, color: "#8c8c85", automatic: false },
];

export const transactions: Transaction[] = [
  { id: "t1", merchant: "Payroll", description: "Direct deposit", date: "Sep 27", amount: 3200, category: "Income", accountId: "boa-checking", status: "reconciled", icon: "briefcase" },
  { id: "t2", merchant: "Publix", description: "Groceries · 9 items", date: "Sep 26", amount: -87.42, category: "Groceries", accountId: "boa-checking", status: "reconciled", icon: "shopping" },
  { id: "t3", merchant: "Robinhood", description: "Investment transfer", date: "Sep 25", amount: -500, category: "Transfer", accountId: "boa-checking", status: "reconciled", icon: "trending" },
  { id: "t4", merchant: "Blue Bottle Coffee", description: "Card purchase", date: "Sep 24", amount: -6.75, category: "Dining", accountId: "boa-checking", status: "needs-review", icon: "coffee" },
  { id: "t5", merchant: "Venmo", description: "From Alex · Dinner repayment", date: "Sep 23", amount: 38, category: "Reimbursement", accountId: "venmo", status: "pending", icon: "users" },
  { id: "t6", merchant: "Spotify", description: "Monthly subscription", date: "Sep 22", amount: -11.99, category: "Subscriptions", accountId: "boa-checking", status: "reconciled", icon: "music" },
  { id: "t7", merchant: "Shell", description: "Fuel", date: "Sep 21", amount: -46.18, category: "Transportation", accountId: "boa-checking", status: "reconciled", icon: "car" },
];

export const budgets: Budget[] = [
  { category: "Groceries", spent: 486, limit: 650, color: "#284c40" },
  { category: "Dining", spent: 278, limit: 400, color: "#ab7650" },
  { category: "Transportation", spent: 164, limit: 300, color: "#7088a3" },
  { category: "Entertainment", spent: 92, limit: 200, color: "#9a8770" },
];

export const netWorthHistory = [
  { month: "Apr", value: 35700 }, { month: "May", value: 36900 }, { month: "Jun", value: 38400 },
  { month: "Jul", value: 39100 }, { month: "Aug", value: 40050 }, { month: "Sep", value: 41265 },
];

export const spendingByCategory = [
  { name: "Groceries", value: 486, color: "#284c40" },
  { name: "Dining", value: 278, color: "#ab7650" },
  { name: "Transport", value: 164, color: "#7088a3" },
  { name: "Shopping", value: 138, color: "#b6a171" },
  { name: "Other", value: 119, color: "#d7d1c4" },
];
