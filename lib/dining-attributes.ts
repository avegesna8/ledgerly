export const diningAttributeOptions = {
  cuisine: [
    "UNKNOWN",
    "AMERICAN",
    "ITALIAN",
    "MEXICAN",
    "CHINESE",
    "JAPANESE",
    "INDIAN",
    "KOREAN",
    "THAI",
    "VIETNAMESE",
    "FILIPINO",
    "MEDITERRANEAN",
    "MIDDLE_EASTERN",
    "FRENCH",
    "SPANISH",
    "AFRICAN",
    "CARIBBEAN",
    "LATIN_AMERICAN",
    "FUSION",
    "OTHER",
  ],
  venueType: [
    "UNKNOWN",
    "FULL_SERVICE_RESTAURANT",
    "FAST_CASUAL",
    "FAST_FOOD",
    "CAFE",
    "BAKERY",
    "BAR_OR_PUB",
    "FOOD_TRUCK",
    "BUFFET",
    "CAFETERIA",
    "CATERER",
    "DELIVERY_ONLY",
    "OTHER",
  ],
  serviceStyle: [
    "UNKNOWN",
    "DINE_IN",
    "COUNTER_SERVICE",
    "TAKEOUT",
    "ONLINE_PICKUP",
    "CURBSIDE_PICKUP",
    "DELIVERY",
    "DRIVE_THROUGH",
    "CATERING",
    "OTHER",
  ],
} as const;

export type DiningAttribute = keyof typeof diningAttributeOptions;

export const diningAttributeLabels: Record<DiningAttribute, string> = {
  cuisine: "Cuisine",
  venueType: "Venue type",
  serviceStyle: "Service style",
};

export function diningValue(value: unknown, attribute: DiningAttribute) {
  const normalized = typeof value === "string" ? value.trim() : "UNKNOWN";
  if (
    normalized.startsWith("CUSTOM:") &&
    normalized.length > 7 &&
    normalized.length <= 87
  )
    return normalized;
  return diningAttributeOptions[attribute].includes(normalized as never)
    ? normalized
    : "UNKNOWN";
}

export function diningLabel(value?: string) {
  if (!value) return "Unknown";
  if (value.startsWith("CUSTOM:")) return value.slice(7);
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
