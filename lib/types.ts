export type AccountKind =
  "checking" | "savings" | "investment" | "wallet" | "cash" | "credit";
export type Account = {
  id: string;
  name: string;
  institution: string;
  kind: AccountKind;
  balance: number;
  change: number;
  lastFour?: string;
  color: string;
  automatic: boolean;
  includeInNetWorth?: boolean;
  lastSyncedAt?: string;
  stale?: boolean;
};

export type TransactionStatus = "reconciled" | "needs-review" | "pending";
export type Transaction = {
  id: string;
  merchant: string;
  description: string;
  date: string;
  amount: number;
  category: string;
  accountId: string;
  status: TransactionStatus;
  icon: string;
  categoryId?: string;
  transactionType?:
    | "INCOME"
    | "EXPENSE"
    | "TRANSFER"
    | "REFUND"
    | "REIMBURSEMENT"
    | "ADJUSTMENT";
  transactedAt?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  website?: string;
  paymentChannel?: string;
  diningCuisine?: string;
  diningVenueType?: string;
  diningServiceStyle?: string;
  receiptId?: string;
  receiptSource?: string;
  receiptStatus?: string;
};

export type CategoryOption = {
  id: string;
  name: string;
  path: string;
  parentId?: string;
};
export type ReceiptItemData = {
  id: string;
  name: string;
  quantity?: number;
  price: number;
  category: string;
  categoryId?: string;
};
export type ReceiptData = {
  id: string;
  filename: string;
  sourceUrl: string;
  mimeType: string;
  source: string;
  status: string;
  merchant?: string;
  purchasedAt?: string;
  total?: number;
  tax?: number;
  confidence?: number;
  matchConfidence?: number;
  transactionId?: string;
  matchedTransaction?: string;
  purchaseChannel?: string;
  diningCuisine?: string;
  diningVenueType?: string;
  diningServiceStyle?: string;
  locationAddress?: string;
  locationCity?: string;
  locationRegion?: string;
  locationPostalCode?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  items: ReceiptItemData[];
};
export type ReceiptConnectionData = {
  id: string;
  provider: string;
  displayName?: string;
  status: string;
  lastSyncedAt?: string;
  folderName?: string;
};
export type PlaidConnectionData = {
  id: string;
  institution: string;
  products: string[];
  accountCount: number;
  newAccountsAvailable: boolean;
  needsAttention: boolean;
  consentExpiresAt?: string;
  lastSyncedAt?: string;
};

export type InvestmentHoldingData = {
  id: string;
  accountId: string;
  accountName: string;
  institution: string;
  securityName: string;
  ticker?: string;
  securityType?: string;
  quantity: number;
  price?: number;
  value: number;
  costBasis?: number;
  gain?: number;
  gainPercent?: number;
};
export type InvestmentActivityData = {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  name: string;
  securityName?: string;
  ticker?: string;
  type: string;
  subtype?: string;
  amount: number;
  quantity?: number;
  price?: number;
  fees?: number;
};
export type InvestmentDashboard = {
  totalValue: number;
  totalCostBasis: number;
  totalGain: number;
  gainPercent: number;
  contributions: number;
  withdrawals: number;
  allocation: SpendingPoint[];
  holdings: InvestmentHoldingData[];
  activities: InvestmentActivityData[];
};

export type ChartPoint = { month: string; value: number };
export type SpendingPoint = { name: string; value: number; color: string };
export type DashboardMetrics = {
  netWorth: number;
  liquid: number;
  investments: number;
  storedValue: number;
  moneyIn: number;
  moneyOut: number;
  internalTransfers: number;
  netChange: number;
  reconciliationRate: number;
  reconciledAmount: number;
  needsDetailsAmount: number;
  netWorthHistory: ChartPoint[];
  spendingByCategory: SpendingPoint[];
  reviewCount: number;
  trackingStartedAt?: string;
};

export type Budget = {
  category: string;
  spent: number;
  limit: number;
  color: string;
};
