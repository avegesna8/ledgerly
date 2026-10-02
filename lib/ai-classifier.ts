import OpenAI from "openai";
import { diningAttributeOptions } from "@/lib/dining-attributes";

type CategoryChoice = { id: string; path: string };
type TransactionInput = {
  merchant: string;
  description: string;
  amount: number;
  date: string;
};

export async function classifyTransaction(
  transaction: TransactionInput,
  categories: CategoryChoice[],
) {
  if (!process.env.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY is not configured.");
  if (!categories.length)
    throw new Error("No categories are available for classification.");
  const model = process.env.OPENAI_CLASSIFIER_MODEL || "gpt-4o-mini";
  const merchantContext =
    `${transaction.merchant} ${transaction.description}`.toLowerCase();
  const diningMerchant =
    /\b(restaurant|ristorante|trattoria|pizzeria|pizza|cafe|café|coffee|espresso|diner|bistro|grill|barbecue|bbq|steakhouse|taqueria|sushi|ramen|sandwich|deli|wich|bakery|food truck|fast food|kitchen|eatery|tavern|pub)\b/.test(
      merchantContext,
    );
  const eligibleCategories = diningMerchant
    ? categories.filter((category) => category.path.startsWith("Dining › "))
    : categories;
  if (!eligibleCategories.length)
    throw new Error("No eligible categories are available for classification.");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const categoryIds = eligibleCategories.map((category) => category.id);
  const response = await client.responses.create({
    model,
    instructions:
      "Classify a personal-finance transaction. Choose exactly one category from the supplied taxonomy. Never invent a category. Use merchant context before the purchased product: restaurants, cafes, takeout, food trucks, bars, and meal delivery are Dining, never Groceries. Groceries is only for supermarkets, grocery stores, and food bought primarily for home preparation. Also classify the independent dining facets cuisine, venue type, and service style using only their allowed values. Multiple dining facets may apply simultaneously. Specialty and purchased-item type belong in the Dining category selection, not in a merchant facet. Use UNKNOWN for every dining facet on non-dining transactions or whenever evidence is insufficient; never guess. When the item type is unknown for a dining transaction, choose Dining › Food Items › Other Prepared Food. Use the most specific category supported by evidence. Confidence must reflect the evidence in the merchant and description. Keep the rationale to one short sentence.",
    input: JSON.stringify({
      transaction,
      merchant_context: diningMerchant
        ? "Known dining establishment"
        : "Determine from evidence",
      allowed_categories: eligibleCategories,
      allowed_dining_attributes: diningAttributeOptions,
    }),
    text: {
      format: {
        type: "json_schema",
        name: "transaction_classification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            category_id: { type: "string", enum: categoryIds },
            dining_cuisine: {
              type: "string",
              enum: diningAttributeOptions.cuisine,
            },
            dining_venue_type: {
              type: "string",
              enum: diningAttributeOptions.venueType,
            },
            dining_service_style: {
              type: "string",
              enum: diningAttributeOptions.serviceStyle,
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            rationale: { type: "string" },
          },
          required: [
            "category_id",
            "dining_cuisine",
            "dining_venue_type",
            "dining_service_style",
            "confidence",
            "rationale",
          ],
          additionalProperties: false,
        },
      },
    },
  });
  if (!response.output_text)
    throw new Error("The classifier returned no result.");
  const result = JSON.parse(response.output_text) as {
    category_id: string;
    dining_cuisine: string;
    dining_venue_type: string;
    dining_service_style: string;
    confidence: number;
    rationale: string;
  };
  if (!categoryIds.includes(result.category_id))
    throw new Error("The classifier selected an unknown category.");
  return {
    categoryId: result.category_id,
    diningCuisine: result.dining_cuisine,
    diningVenueType: result.dining_venue_type,
    diningServiceStyle: result.dining_service_style,
    confidence: result.confidence,
    rationale: result.rationale,
    model,
  };
}
