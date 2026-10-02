"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, Globe2, MapPin, Search, X } from "lucide-react";

type Target = {
  entityType: "transaction" | "receipt";
  entityId: string;
  merchant: string;
  query: string;
  latitude?: number;
  longitude?: number;
};
type Place = {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
};

export function LocationLookupModal({
  target,
  onClose,
  onConfirmed,
}: {
  target: Target | null;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [query, setQuery] = useState(target?.query ?? "");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState("");
  const [working, setWorking] = useState<
    "search" | "confirm" | "online" | null
  >(null);
  const [error, setError] = useState("");
  if (!target) return null;
  async function search(event: FormEvent) {
    event.preventDefault();
    setWorking("search");
    setError("");
    setSelected("");
    const response = await fetch("/api/locations/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        latitude: target?.latitude,
        longitude: target?.longitude,
      }),
    });
    const result = await response.json();
    setWorking(null);
    if (!response.ok) {
      setError(result.error ?? "Place search failed.");
      return;
    }
    setPlaces(result.places ?? []);
    if (!(result.places ?? []).length)
      setError(
        "No matching places found. Add a city, state, or ZIP and try again.",
      );
  }
  async function confirm() {
    if (!selected) return;
    setWorking("confirm");
    setError("");
    const response = await fetch("/api/locations/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: target?.entityType,
        entityId: target?.entityId,
        placeId: selected,
      }),
    });
    const result = await response.json();
    setWorking(null);
    if (!response.ok) {
      setError(result.error ?? "Could not save this place.");
      return;
    }
    onConfirmed();
  }
  async function markOnline() {
    setWorking("online");
    setError("");
    const response = await fetch("/api/locations/online", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: target?.entityType,
        entityId: target?.entityId,
      }),
    });
    const result = await response.json();
    setWorking(null);
    if (!response.ok) {
      setError(result.error ?? "Could not mark this purchase as online.");
      return;
    }
    onConfirmed();
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="modal location-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="label">GOOGLE PLACES</span>
            <h2>Where was this purchase?</h2>
            <p>
              Mark it as online or choose the exact physical branch for{" "}
              {target.merchant}.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <button
          className="online-purchase-option"
          disabled={Boolean(working)}
          onClick={markOnline}
        >
          <Globe2 size={19} />
          <span>
            <strong>This was an online purchase</strong>
            <small>No physical location will be attached.</small>
          </span>
          {working === "online" ? "Saving…" : "Choose"}
        </button>
        <div className="location-divider">
          <span>or find a physical location</span>
        </div>
        <form className="place-search" onSubmit={search}>
          <div className="search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Merchant, address, city, or ZIP"
              required
              autoFocus
            />
          </div>
          <button className="button" disabled={Boolean(working)}>
            {working === "search" ? "Searching…" : "Search"}
          </button>
        </form>
        {error && <p className="form-error location-error">{error}</p>}
        <div className="place-results">
          {places.map((place) => (
            <label
              className={`place-result ${selected === place.id ? "selected" : ""}`}
              key={place.id}
            >
              <input
                type="radio"
                name="place"
                value={place.id}
                checked={selected === place.id}
                onChange={() => setSelected(place.id)}
              />
              <MapPin size={18} />
              <span>
                <strong>{place.name}</strong>
                <small>{place.address}</small>
              </span>
              {place.mapsUrl && (
                <a
                  href={place.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  aria-label="Preview in Google Maps"
                >
                  <ExternalLink size={15} />
                </a>
              )}
            </label>
          ))}
        </div>
        <footer>
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button"
            disabled={!selected || Boolean(working)}
            onClick={confirm}
          >
            {working === "confirm" ? "Saving…" : "Confirm location"}
          </button>
        </footer>
      </section>
    </div>
  );
}
