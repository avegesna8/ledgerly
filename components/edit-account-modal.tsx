"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Account, AccountKind } from "@/lib/types";

const databaseType: Record<AccountKind, string> = {
  checking: "CHECKING",
  savings: "SAVINGS",
  investment: "INVESTMENT",
  wallet: "WALLET",
  cash: "CASH",
  credit: "STORED_CREDIT",
};

export function EditAccountModal({ account, onClose, onUpdated }: { account: Account | null; onClose: () => void; onUpdated: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!account) return; const close = (event: KeyboardEvent) => event.key === "Escape" && onClose(); window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [account, onClose]);
  if (!account) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError("");
    const response = await fetch(`/api/accounts/${account!.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const result = await response.json(); setSubmitting(false);
    if (!response.ok) return setError(result.error ?? "Could not update the account.");
    onUpdated();
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-account-title"><header><div><span className="label">MONEY LOCATION</span><h2 id="edit-account-title">Edit account</h2><p>Changing the balance records a new historical snapshot.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header><form onSubmit={submit}><label>Account name<input name="name" required defaultValue={account.name} autoFocus/></label><label>Institution or provider<input name="provider" required defaultValue={account.institution}/></label><div className="form-grid"><label>Account type<select name="type" defaultValue={databaseType[account.kind]}><option value="CHECKING">Checking</option><option value="SAVINGS">Savings</option><option value="INVESTMENT">Investment</option><option value="WALLET">Digital wallet</option><option value="CASH">Cash</option><option value="STORED_CREDIT">Stored credit</option><option value="LIABILITY">Liability</option><option value="OTHER">Other</option></select></label><label>Current balance<div className="money-input"><span>$</span><input name="balance" required type="number" step="0.01" defaultValue={account.balance.toFixed(2)}/></div></label></div>{error && <p className="form-error">{error}</p>}<footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button" disabled={submitting}>{submitting ? "Saving…" : "Save changes"}</button></footer></form></section></div>;
}
