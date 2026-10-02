"use client";

import { useEffect, useState } from "react";
import {
  diningAttributeLabels,
  diningAttributeOptions,
  diningLabel,
  type DiningAttribute,
} from "@/lib/dining-attributes";

type CustomOption = {
  id?: string;
  attribute: DiningAttribute;
  label: string;
  value: string;
};

function AttributeSelect({
  attribute,
  name,
  initialValue,
  customOptions,
  onAdded,
}: {
  attribute: DiningAttribute;
  name: string;
  initialValue?: string;
  customOptions: CustomOption[];
  onAdded: (option: CustomOption) => void;
}) {
  const [value, setValue] = useState(initialValue ?? "UNKNOWN");
  const [adding, setAdding] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const relevant = customOptions.filter(
    (option) => option.attribute === attribute,
  );
  const initialCustom =
    initialValue?.startsWith("CUSTOM:") &&
    !relevant.some((option) => option.value === initialValue)
      ? {
          attribute,
          label: diningLabel(initialValue),
          value: initialValue,
        }
      : null;

  async function addCustom() {
    if (!customLabel.trim()) return;
    setSaving(true);
    setError("");
    const response = await fetch("/api/category-attributes/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attribute, label: customLabel }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(result.error ?? "Could not add this option.");
      return;
    }
    const option = result.option as CustomOption;
    onAdded(option);
    setValue(option.value);
    setCustomLabel("");
    setAdding(false);
  }

  return (
    <label>
      {diningAttributeLabels[attribute]}
      <select
        name={name}
        value={value}
        onChange={(event) => {
          if (event.target.value === "__ADD_CUSTOM__") {
            setAdding(true);
            return;
          }
          setValue(event.target.value);
          setAdding(false);
        }}
      >
        {diningAttributeOptions[attribute].map((option) => (
          <option value={option} key={option}>
            {diningLabel(option)}
          </option>
        ))}
        {initialCustom && (
          <option value={initialCustom.value}>{initialCustom.label}</option>
        )}
        {relevant.map((option) => (
          <option value={option.value} key={option.id ?? option.value}>
            {option.label}
          </option>
        ))}
        <option value="__ADD_CUSTOM__">＋ Add custom value…</option>
      </select>
      {adding && (
        <span className="custom-attribute-entry">
          <input
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
            placeholder={`New ${diningAttributeLabels[attribute].toLowerCase()}`}
            maxLength={80}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addCustom();
              }
            }}
          />
          <button
            type="button"
            className="button secondary"
            disabled={saving || !customLabel.trim()}
            onClick={addCustom}
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </span>
      )}
      {error && <small className="form-error">{error}</small>}
    </label>
  );
}

export function DiningAttributeFields({
  values,
}: {
  values?: {
    diningCuisine?: string;
    diningVenueType?: string;
    diningServiceStyle?: string;
  };
}) {
  const [customOptions, setCustomOptions] = useState<CustomOption[]>([]);
  useEffect(() => {
    let active = true;
    fetch("/api/category-attributes/options")
      .then((response) => response.json())
      .then((result) => {
        if (active && Array.isArray(result.options))
          setCustomOptions(result.options);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const fields: Array<{
    attribute: DiningAttribute;
    name: string;
    value?: string;
  }> = [
    {
      attribute: "cuisine",
      name: "diningCuisine",
      value: values?.diningCuisine,
    },
    {
      attribute: "venueType",
      name: "diningVenueType",
      value: values?.diningVenueType,
    },
    {
      attribute: "serviceStyle",
      name: "diningServiceStyle",
      value: values?.diningServiceStyle,
    },
  ];
  return (
    <fieldset className="dining-attribute-fields">
      <legend>Dining details</legend>
      <p>
        Choose a predefined value or add a custom value that will remain in this
        dropdown for future records.
      </p>
      <div className="form-grid">
        {fields.map((field) => (
          <AttributeSelect
            key={field.name}
            attribute={field.attribute}
            name={field.name}
            initialValue={field.value}
            customOptions={customOptions}
            onAdded={(option) =>
              setCustomOptions((current) =>
                current.some(
                  (existing) =>
                    existing.attribute === option.attribute &&
                    existing.value === option.value,
                )
                  ? current
                  : [...current, option],
              )
            }
          />
        ))}
      </div>
    </fieldset>
  );
}
