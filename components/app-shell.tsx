"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Account,
  CategoryOption,
  DashboardMetrics,
  InvestmentDashboard,
  PlaidConnectionData,
  ReceiptConnectionData,
  ReceiptData,
  Transaction,
} from "@/lib/types";
import { Sidebar } from "./sidebar";
import { Overview } from "./overview";
import {
  AccountsPage,
  AnalyticsPage,
  BudgetsPage,
  ReviewPage,
  SettingsPage,
  TransactionsPage,
  InvestmentsPage,
} from "./pages";
import { AddAccountModal } from "./add-account-modal";
import { EditAccountModal } from "./edit-account-modal";
import { TransactionModal } from "./transaction-modal";
import { ReceiptUploadModal } from "./receipt-upload-modal";

export function AppShell({
  accounts,
  transactions,
  categories,
  receipts,
  receiptConnections,
  plaidConnections,
  investments,
  metrics,
}: {
  accounts: Account[];
  transactions: Transaction[];
  categories: CategoryOption[];
  receipts: ReceiptData[];
  receiptConnections: ReceiptConnectionData[];
  plaidConnections: PlaidConnectionData[];
  investments: InvestmentDashboard;
  metrics: DashboardMetrics;
}) {
  const [page, setPage] = useState("Overview");
  const [addingAccount, setAddingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [transactionModal, setTransactionModal] = useState<{
    open: boolean;
    transaction: Transaction | null;
  }>({ open: false, transaction: null });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptTransactionId, setReceiptTransactionId] = useState<
    string | undefined
  >();
  const router = useRouter();
  const gmailScanStarted = useRef(false);
  const driveScanStarted = useRef(false);
  useEffect(() => {
    const gmail = receiptConnections.find(
      (connection) =>
        connection.provider === "GMAIL" && connection.status === "ACTIVE",
    );
    if (!gmail || gmailScanStarted.current) return;
    const last = gmail.lastSyncedAt
      ? new Date(gmail.lastSyncedAt).getTime()
      : 0;
    if (Date.now() - last < 15 * 60 * 1000) return;
    gmailScanStarted.current = true;
    fetch("/api/integrations/gmail/sync", { method: "POST" })
      .then((response) => {
        if (response.ok) router.refresh();
      })
      .catch(() => undefined);
  }, [receiptConnections, router]);
  useEffect(() => {
    const drive = receiptConnections.find(
      (connection) =>
        connection.provider === "GOOGLE_DRIVE" &&
        connection.status === "ACTIVE" &&
        connection.folderName,
    );
    if (!drive || driveScanStarted.current) return;
    const last = drive.lastSyncedAt
      ? new Date(drive.lastSyncedAt).getTime()
      : 0;
    if (Date.now() - last < 15 * 60 * 1000) return;
    driveScanStarted.current = true;
    fetch("/api/integrations/drive/sync", { method: "POST" })
      .then((response) => {
        if (response.ok) router.refresh();
      })
      .catch(() => undefined);
  }, [receiptConnections, router]);
  const views: Record<string, React.ReactNode> = {
    Overview: (
      <Overview
        accounts={accounts}
        transactions={transactions}
        metrics={metrics}
        onNavigate={setPage}
        onAddAccount={() => setAddingAccount(true)}
        onBankConnected={() => router.refresh()}
      />
    ),
    "Money flow": (
      <AccountsPage
        accounts={accounts}
        metrics={metrics}
        investments={investments}
        onAddAccount={() => setAddingAccount(true)}
        onEditAccount={setEditingAccount}
      />
    ),
    Investments: (
      <InvestmentsPage
        investments={investments}
        accounts={accounts}
        plaidConnections={plaidConnections}
        onUpdated={() => router.refresh()}
      />
    ),
    Transactions: (
      <TransactionsPage
        transactions={transactions}
        accounts={accounts}
        trackingStartedAt={metrics.trackingStartedAt}
        onAdd={() => setTransactionModal({ open: true, transaction: null })}
        onEdit={(transaction) =>
          setTransactionModal({ open: true, transaction })
        }
      />
    ),
    Analytics: (
      <AnalyticsPage
        metrics={metrics}
        accounts={accounts}
        transactions={transactions}
        investments={investments}
      />
    ),
    Budgets: <BudgetsPage />,
    "Needs review": (
      <ReviewPage
        metrics={metrics}
        transactions={transactions}
        accounts={accounts}
        receipts={receipts}
        categories={categories}
        onReview={(transaction) =>
          setTransactionModal({ open: true, transaction })
        }
        onUploadReceipt={() => setUploadingReceipt(true)}
        onUpdated={() => router.refresh()}
      />
    ),
    Settings: (
      <SettingsPage
        accounts={accounts}
        plaidConnections={plaidConnections}
        receiptConnections={receiptConnections}
        onUpdated={() => router.refresh()}
      />
    ),
  };
  return (
    <div className="app-shell">
      <Sidebar
        active={page}
        onNavigate={setPage}
        reviewCount={metrics.reviewCount}
      />
      <main className="content">{views[page]}</main>
      <AddAccountModal
        open={addingAccount}
        onClose={() => setAddingAccount(false)}
        onCreated={() => {
          setAddingAccount(false);
          router.refresh();
        }}
      />
      <EditAccountModal
        account={editingAccount}
        onClose={() => setEditingAccount(null)}
        onUpdated={() => {
          setEditingAccount(null);
          router.refresh();
        }}
      />
      <TransactionModal
        key={
          transactionModal.open
            ? (transactionModal.transaction?.id ?? "new")
            : "closed"
        }
        open={transactionModal.open}
        transaction={transactionModal.transaction}
        accounts={accounts}
        categories={categories}
        onClose={() => setTransactionModal({ open: false, transaction: null })}
        onSaved={() => {
          setTransactionModal({ open: false, transaction: null });
          router.refresh();
        }}
        onAttachReceipt={(transaction) => {
          setTransactionModal({ open: false, transaction: null });
          setReceiptTransactionId(transaction.id);
          setUploadingReceipt(true);
        }}
      />
      <ReceiptUploadModal
        open={uploadingReceipt}
        transactionId={receiptTransactionId}
        onClose={() => {
          setUploadingReceipt(false);
          setReceiptTransactionId(undefined);
        }}
        onUploaded={() => {
          setUploadingReceipt(false);
          setReceiptTransactionId(undefined);
          setPage("Needs review");
          router.refresh();
        }}
      />
    </div>
  );
}
