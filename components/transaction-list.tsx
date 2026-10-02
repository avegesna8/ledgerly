import {
  BriefcaseBusiness,
  CarFront,
  Coffee,
  Music2,
  Paperclip,
  ShoppingBasket,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  accounts as demoAccounts,
  transactions as demoTransactions,
} from "@/lib/data";
import type { Account, Transaction } from "@/lib/types";

const icons = {
  briefcase: BriefcaseBusiness,
  car: CarFront,
  coffee: Coffee,
  music: Music2,
  shopping: ShoppingBasket,
  trending: TrendingUp,
  users: Users,
};

export function TransactionList({
  full = false,
  transactions = demoTransactions,
  accounts = demoAccounts,
  onEdit,
}: {
  full?: boolean;
  transactions?: Transaction[];
  accounts?: Account[];
  onEdit?: (transaction: Transaction) => void;
}) {
  const rows = full ? transactions : transactions.slice(0, 5);
  return (
    <div className="transaction-list">
      {rows.map((t) => {
        const Icon = icons[t.icon as keyof typeof icons] ?? ShoppingBasket;
        const account = accounts.find((a) => a.id === t.accountId);
        return (
          <div
            className={`transaction ${onEdit ? "editable" : ""}`}
            key={t.id}
            onClick={() => onEdit?.(t)}
            role={onEdit ? "button" : undefined}
            tabIndex={onEdit ? 0 : undefined}
            onKeyDown={(event) => {
              if (onEdit && (event.key === "Enter" || event.key === " "))
                onEdit(t);
            }}
          >
            <span
              className={`transaction-icon ${t.amount > 0 ? "positive" : ""}`}
            >
              <Icon size={18} />
            </span>
            <span className="transaction-main">
              <strong>{t.merchant}</strong>
              <small>
                {t.location || t.description}
                {t.paymentChannel
                  ? ` · ${t.paymentChannel.toLowerCase().replaceAll("_", " ")}`
                  : ""}
              </small>
              {t.location && <small>{t.description}</small>}
              {t.receiptId && (
                <small className="receipt-link">
                  <Paperclip size={10} />
                  {t.receiptStatus === "confirmed"
                    ? "Receipt attached"
                    : `Receipt proposed · ${(t.receiptSource ?? "receipt").toLowerCase().replaceAll("_", " ")}`}
                </small>
              )}
            </span>
            {full && <span className="transaction-category">{t.category}</span>}
            {full && (
              <span className={`status ${t.status}`}>
                {t.status.replace("-", " ")}
              </span>
            )}
            <span className="transaction-account">
              <strong>{t.date}</strong>
              <small>{account?.name}</small>
            </span>
            <strong
              className={t.amount > 0 ? "amount positive-text" : "amount"}
            >
              {t.amount > 0 ? "+" : "−"}${Math.abs(t.amount).toFixed(2)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}
