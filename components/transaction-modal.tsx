"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Trash2, X } from "lucide-react";
import type { Account, CategoryOption, Transaction } from "@/lib/types";
import { DiningAttributeFields } from "./dining-attribute-fields";

export function CategoryPicker({
  categories,
  initialId,
  name = "categoryId",
}: {
  categories: CategoryOption[];
  initialId?: string;
  name?: string;
}) {
  const [availableCategories, setAvailableCategories] = useState(categories);
  const [addingAt, setAddingAt] = useState<{
    level: number;
    parentId?: string;
  } | null>(null);
  const [customName, setCustomName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  useEffect(() => setAvailableCategories(categories), [categories]);
  const byId = useMemo(
    () =>
      new Map(availableCategories.map((category) => [category.id, category])),
    [availableCategories],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, CategoryOption[]>();
    for (const category of availableCategories) {
      const key = category.parentId ?? "root";
      map.set(key, [...(map.get(key) ?? []), category]);
    }
    for (const values of map.values())
      values.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [availableCategories]);
  const initialPath = useMemo(() => {
    const ids: string[] = [];
    let current = initialId ? byId.get(initialId) : undefined;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      ids.unshift(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    if (!ids.length && availableCategories.length) {
      let first = childrenByParent.get("root")?.[0];
      while (first) {
        ids.push(first.id);
        first = childrenByParent.get(first.id)?.[0];
      }
    }
    return ids;
  }, [byId, availableCategories, childrenByParent, initialId]);
  const [selectedIds, setSelectedIds] = useState(initialPath);
  const selectedId = selectedIds.at(-1) ?? "";
  const levels: { options: CategoryOption[]; selected: string }[] = [];
  let options = childrenByParent.get("root") ?? [];
  let level = 0;
  while (options.length) {
    const selected = selectedIds[level] ?? "";
    levels.push({ options, selected });
    if (!selected) break;
    options = childrenByParent.get(selected) ?? [];
    level++;
  }
  const selected = byId.get(selectedId);
  const isLeaf = selected && !childrenByParent.has(selected.id);
  const labels = ["Category", "Group", "Type", "Detail", "More detail"];
  function choose(levelIndex: number, id: string) {
    if (id === "__ADD_CUSTOM__") {
      setAddingAt({
        level: levelIndex,
        parentId: selectedIds[levelIndex - 1],
      });
      setCustomName("");
      setCategoryError("");
      return;
    }
    setAddingAt(null);
    setSelectedIds((current) => [
      ...current.slice(0, levelIndex),
      ...(id ? [id] : []),
    ]);
  }
  async function addCustomCategory() {
    if (!addingAt || !customName.trim()) return;
    setAddingCategory(true);
    setCategoryError("");
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: customName, parentId: addingAt.parentId }),
    });
    const result = await response.json();
    setAddingCategory(false);
    if (!response.ok) {
      setCategoryError(result.error ?? "Could not add this category.");
      return;
    }
    const parent = addingAt.parentId ? byId.get(addingAt.parentId) : undefined;
    const category: CategoryOption = {
      id: result.category.id,
      name: result.category.name,
      parentId: result.category.parentId ?? undefined,
      path: parent
        ? `${parent.path} › ${result.category.name}`
        : result.category.name,
    };
    setAvailableCategories((current) =>
      current.some((entry) => entry.id === category.id)
        ? current
        : [...current, category],
    );
    setSelectedIds((current) => [
      ...current.slice(0, addingAt.level),
      category.id,
    ]);
    setAddingAt(null);
    setCustomName("");
  }
  return (
    <fieldset className="category-picker">
      <legend>Category</legend>
      <input type="hidden" name={name} value={selectedId} />
      <div className="category-levels">
        {levels.map((entry, index) => (
          <label key={`${index}-${entry.options[0]?.parentId ?? "root"}`}>
            {labels[index] ?? `Level ${index + 1}`}
            <select
              required
              value={entry.selected}
              onChange={(event) => choose(index, event.target.value)}
            >
              <option value="">Choose…</option>
              {entry.options.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
              <option value="__ADD_CUSTOM__">＋ Add custom category…</option>
            </select>
          </label>
        ))}
      </div>
      {addingAt && (
        <div className="custom-category-entry">
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="New category name"
            maxLength={60}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addCustomCategory();
              }
            }}
          />
          <button
            type="button"
            className="button secondary"
            disabled={addingCategory || !customName.trim()}
            onClick={addCustomCategory}
          >
            {addingCategory ? "Adding…" : "Add category"}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => setAddingAt(null)}
          >
            Cancel
          </button>
        </div>
      )}
      {categoryError && <p className="form-error">{categoryError}</p>}
      {selected && (
        <div
          className={`category-choice ${isLeaf ? "complete" : "incomplete"}`}
        >
          {isLeaf ? <Check size={14} /> : <ChevronRight size={14} />}
          <span>
            <small>
              {isLeaf ? "Specific category" : "Choose a more specific option"}
            </small>
            {selected.path}
          </span>
        </div>
      )}
    </fieldset>
  );
}

export function TransactionModal({
  open,
  transaction,
  accounts,
  categories,
  onClose,
  onSaved,
  onAttachReceipt,
}: {
  open: boolean;
  transaction: Transaction | null;
  accounts: Account[];
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: () => void;
  onAttachReceipt: (transaction: Transaction) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);
  if (!open) return null;
  const editing = Boolean(transaction);
  const defaultDate =
    transaction?.transactedAt?.slice(0, 10) ??
    new Date().toISOString().slice(0, 10);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const response = await fetch(
      transaction ? `/api/transactions/${transaction.id}` : "/api/transactions",
      {
        method: transaction ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(new FormData(event.currentTarget)),
        ),
      },
    );
    const result = await response.json();
    setSubmitting(false);
    if (!response.ok)
      return setError(result.error ?? "Could not save the transaction.");
    onSaved();
  }
  async function remove() {
    if (!transaction) return;
    setSubmitting(true);
    setError("");
    const response = await fetch(`/api/transactions/${transaction.id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    setSubmitting(false);
    if (!response.ok)
      return setError(result.error ?? "Could not delete the transaction.");
    onSaved();
  }
  if (confirmingDelete)
    return (
      <div className="modal-backdrop">
        <section
          className="modal confirm-modal"
          role="alertdialog"
          aria-modal="true"
        >
          <span className="danger-icon">
            <Trash2 size={22} />
          </span>
          <h2>Delete this transaction?</h2>
          <p>
            This will remove <strong>{transaction?.merchant}</strong> and
            restore{" "}
            {transaction?.amount &&
              Math.abs(transaction.amount).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}{" "}
            to the account balance. The deletion remains in the audit history.
          </p>
          {error && <p className="form-error">{error}</p>}
          <footer>
            <button
              className="button secondary"
              onClick={() => setConfirmingDelete(false)}
            >
              Keep transaction
            </button>
            <button
              className="button danger"
              disabled={submitting}
              onClick={remove}
            >
              {submitting ? "Deleting…" : "Delete transaction"}
            </button>
          </footer>
        </section>
      </div>
    );
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal transaction-modal"
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <span className="label">LEDGER ENTRY</span>
            <h2>{editing ? "Review transaction" : "Add transaction"}</h2>
            <p>Review every detail before confirming this ledger entry.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Merchant or description
            <input
              name="merchant"
              required
              autoFocus
              defaultValue={transaction?.merchant ?? ""}
              placeholder="e.g. Publix"
            />
          </label>
          <div className="form-grid">
            <label>
              Type
              <select
                name="type"
                defaultValue={transaction?.transactionType ?? "EXPENSE"}
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
                <option value="TRANSFER">Transfer out</option>
                <option value="REFUND">Refund</option>
                <option value="REIMBURSEMENT">Reimbursement</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </label>
            <label>
              Amount
              <div className="money-input">
                <span>$</span>
                <input
                  name="amount"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={
                    transaction
                      ? Math.abs(transaction.amount).toFixed(2)
                      : "0.00"
                  }
                />
              </div>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Account
              <select
                name="accountId"
                required
                defaultValue={transaction?.accountId ?? accounts[0]?.id}
              >
                {accounts.map((account) => (
                  <option value={account.id} key={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                name="date"
                required
                type="date"
                defaultValue={defaultDate}
              />
            </label>
          </div>
          <label>
            Purchase channel
            <select
              name="paymentChannel"
              defaultValue={
                transaction?.paymentChannel
                  ?.toUpperCase()
                  .replaceAll(" ", "_") ?? "UNKNOWN"
              }
            >
              <option value="IN_STORE">In store</option>
              <option value="ONLINE">Online</option>
              <option value="DELIVERY">Delivery</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </label>
          <CategoryPicker
            categories={categories}
            initialId={transaction?.categoryId}
          />
          <DiningAttributeFields values={transaction ?? undefined} />
          {error && <p className="form-error">{error}</p>}
          <footer className={editing ? "split-footer" : ""}>
            {editing && (
              <>
                <button
                  type="button"
                  className="delete-link"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={14} /> Delete
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => transaction && onAttachReceipt(transaction)}
                >
                  Attach receipt
                </button>
              </>
            )}
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button" disabled={submitting}>
              {submitting
                ? "Saving…"
                : editing
                  ? "Confirm transaction"
                  : "Add for review"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
