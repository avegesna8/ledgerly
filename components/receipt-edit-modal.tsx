"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { CategoryOption, ReceiptData } from "@/lib/types";
import { CategoryPicker } from "./transaction-modal";
import { DiningAttributeFields } from "./dining-attribute-fields";

type EditableItem = {
  key: string;
  name: string;
  quantity: string;
  price: string;
  categoryId?: string;
};

export function ReceiptEditModal({
  receipt,
  categories,
  onClose,
  onSaved,
}: {
  receipt: ReceiptData | null;
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<EditableItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (receipt)
      setItems(
        receipt.items.map((item) => ({
          key: item.id,
          name: item.name,
          quantity: item.quantity?.toString() ?? "",
          price: item.price.toFixed(2),
          categoryId: item.categoryId,
        })),
      );
  }, [receipt]);
  useEffect(() => {
    if (!receipt) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [receipt, onClose]);
  if (!receipt) return null;
  function changeItem(
    key: string,
    field: "name" | "quantity" | "price",
    value: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
  }
  function addItem() {
    setItems((current) => [
      ...current,
      {
        key: `new-${crypto.randomUUID()}`,
        name: "",
        quantity: "1",
        price: "0.00",
      },
    ]);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      merchant: form.get("merchant"),
      purchasedAt: form.get("purchasedAt"),
      total: form.get("total"),
      tax: form.get("tax"),
      purchaseChannel: form.get("purchaseChannel"),
      diningCuisine: form.get("diningCuisine"),
      diningVenueType: form.get("diningVenueType"),
      diningServiceStyle: form.get("diningServiceStyle"),
      locationAddress: form.get("locationAddress"),
      locationCity: form.get("locationCity"),
      locationRegion: form.get("locationRegion"),
      locationPostalCode: form.get("locationPostalCode"),
      locationCountry: form.get("locationCountry"),
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        categoryId: form.get(`category-${item.key}`),
      })),
    };
    const response = await fetch(`/api/receipts/${receipt!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setError(result.error ?? "Could not save the receipt.");
      return;
    }
    onSaved();
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal receipt-edit-modal"
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <span className="label">RECEIPT DETAILS</span>
            <h2>Edit receipt</h2>
            <p>Correct the AI extraction before confirming the match.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Merchant
            <input
              name="merchant"
              required
              defaultValue={receipt.merchant ?? ""}
            />
          </label>
          <div className="form-grid">
            <label>
              Purchase date
              <input
                name="purchasedAt"
                type="date"
                defaultValue={receipt.purchasedAt?.slice(0, 10) ?? ""}
              />
            </label>
            <label>
              Purchase channel
              <select
                name="purchaseChannel"
                defaultValue={receipt.purchaseChannel ?? "UNKNOWN"}
              >
                <option value="IN_STORE">In store</option>
                <option value="ONLINE">Online</option>
                <option value="DELIVERY">Delivery</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </label>
          </div>
          <DiningAttributeFields values={receipt} />
          <div className="form-grid">
            <label>
              Total
              <div className="money-input">
                <span>$</span>
                <input
                  name="total"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={receipt.total?.toFixed(2) ?? ""}
                />
              </div>
            </label>
            <label>
              Tax
              <div className="money-input">
                <span>$</span>
                <input
                  name="tax"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={receipt.tax?.toFixed(2) ?? ""}
                />
              </div>
            </label>
          </div>
          <label>
            Street address
            <input
              name="locationAddress"
              defaultValue={receipt.locationAddress ?? ""}
            />
          </label>
          <div className="form-grid">
            <label>
              City
              <input
                name="locationCity"
                defaultValue={receipt.locationCity ?? ""}
              />
            </label>
            <label>
              State / region
              <input
                name="locationRegion"
                defaultValue={receipt.locationRegion ?? ""}
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Postal code
              <input
                name="locationPostalCode"
                defaultValue={receipt.locationPostalCode ?? ""}
              />
            </label>
            <label>
              Country
              <input
                name="locationCountry"
                defaultValue={receipt.locationCountry ?? ""}
              />
            </label>
          </div>
          <section className="receipt-line-editor">
            <div className="line-editor-head">
              <div>
                <span className="label">LINE ITEMS</span>
                <p>
                  Correct names, quantities, prices, and detailed categories.
                </p>
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={addItem}
              >
                <Plus size={13} />
                Add item
              </button>
            </div>
            {items.map((item, index) => (
              <article className="editable-receipt-item" key={item.key}>
                <div className="line-item-title">
                  <strong>Item {index + 1}</strong>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() =>
                      setItems((current) =>
                        current.filter((entry) => entry.key !== item.key),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="form-grid receipt-item-values">
                  <label>
                    Description
                    <input
                      required
                      value={item.name}
                      onChange={(event) =>
                        changeItem(item.key, "name", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={item.quantity}
                      onChange={(event) =>
                        changeItem(item.key, "quantity", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Price
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(event) =>
                        changeItem(item.key, "price", event.target.value)
                      }
                    />
                  </label>
                </div>
                <CategoryPicker
                  key={`${receipt.id}-${item.key}`}
                  categories={categories}
                  initialId={item.categoryId}
                  name={`category-${item.key}`}
                />
              </article>
            ))}
          </section>
          {error && <p className="form-error">{error}</p>}
          <footer>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button" disabled={submitting}>
              {submitting ? "Saving…" : "Save corrections"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
