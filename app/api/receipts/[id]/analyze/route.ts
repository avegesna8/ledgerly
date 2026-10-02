import { readFile } from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diningAttributeOptions } from "@/lib/dining-attributes";

function similarity(a: string, b: string) {
  const left = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(/\s+/)
      .filter(Boolean),
  );
  const right = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(/\s+/)
      .filter(Boolean),
  );
  if (!left.size || !right.size) return 0;
  const common = [...left].filter((value) => right.has(value)).length;
  return common / Math.max(left.size, right.size);
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 503 },
    );
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      user: { include: { categories: { where: { isActive: true } } } },
    },
  });
  if (!receipt)
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  try {
    const categoriesById = new Map(
      receipt.user.categories.map((category) => [category.id, category]),
    );
    const parentIds = new Set(
      receipt.user.categories.flatMap((category) =>
        category.parentId ? [category.parentId] : [],
      ),
    );
    const pathFor = (categoryId: string) => {
      const parts: string[] = [];
      let current = categoriesById.get(categoryId);
      while (current) {
        parts.unshift(current.name);
        current = current.parentId
          ? categoriesById.get(current.parentId)
          : undefined;
      }
      return parts.join(" › ");
    };
    const choices = receipt.user.categories
      .filter((category) => !parentIds.has(category.id))
      .map((category) => ({ id: category.id, path: pathFor(category.id) }));
    const bytes = await readFile(
      path.join(process.cwd(), "storage", "receipts", receipt.storageKey),
    );
    const dataUrl = `data:${receipt.mimeType};base64,${bytes.toString("base64")}`;
    const documentPart = receipt.mimeType.startsWith("text/")
      ? {
          type: "input_text" as const,
          text: bytes.toString("utf8"),
        }
      : receipt.mimeType === "application/pdf"
        ? {
            type: "input_file" as const,
            filename: receipt.originalFilename,
            file_data: dataUrl,
            detail: "high" as const,
          }
        : {
            type: "input_image" as const,
            image_url: dataUrl,
            detail: "high" as const,
          };
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_CLASSIFIER_MODEL || "gpt-4o-mini",
      instructions:
        "Extract this purchase receipt faithfully. Do not invent unreadable values. Infer purchase_channel as ONLINE only with evidence of an online order, IN_STORE for a physical point-of-sale purchase, DELIVERY for a delivered order, and UNKNOWN when evidence is insufficient. For dining receipts, independently classify cuisine, venue type, and service style using only the supplied allowed values; several facets can apply simultaneously. Specialty and item type belong in each line item's Dining category, not in a merchant facet. Use UNKNOWN rather than guessing and use UNKNOWN for non-dining receipts. Categorize each line item using exactly one supplied leaf category ID. Merchant context takes priority: if this is a restaurant, cafe, takeout, food truck, bar, or meal-delivery receipt, every prepared-food line item must use a Dining category and never a Groceries category. Groceries is only for supermarkets, grocery stores, and food bought primarily for home preparation. Restaurant extras and modifiers must use the most specific category under Dining › Add-ons & Modifiers, including zero-cost preparation or spice choices. Use Dining › Food Items › Other Prepared Food when a receipt proves it is dining but does not support a more specific item type. Prices must be line totals. Return null for unknown optional fields.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task: "Extract and categorize receipt",
                allowed_categories: choices,
                allowed_dining_attributes: diningAttributeOptions,
              }),
            },
            documentPart,
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "receipt_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              merchant: { type: ["string", "null"] },
              purchased_at: { type: ["string", "null"] },
              purchase_channel: {
                type: "string",
                enum: ["IN_STORE", "ONLINE", "DELIVERY", "UNKNOWN"],
              },
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
              total: { type: ["number", "null"] },
              tax: { type: ["number", "null"] },
              address: { type: ["string", "null"] },
              city: { type: ["string", "null"] },
              region: { type: ["string", "null"] },
              postal_code: { type: ["string", "null"] },
              country: { type: ["string", "null"] },
              raw_text: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    quantity: { type: ["number", "null"] },
                    price: { type: "number" },
                    category_id: {
                      type: "string",
                      enum: choices.map((choice) => choice.id),
                    },
                  },
                  required: ["name", "quantity", "price", "category_id"],
                  additionalProperties: false,
                },
              },
            },
            required: [
              "merchant",
              "purchased_at",
              "purchase_channel",
              "dining_cuisine",
              "dining_venue_type",
              "dining_service_style",
              "total",
              "tax",
              "address",
              "city",
              "region",
              "postal_code",
              "country",
              "raw_text",
              "confidence",
              "items",
            ],
            additionalProperties: false,
          },
        },
      },
    });
    if (!response.output_text)
      throw new Error("Receipt analysis returned no result.");
    const extracted = JSON.parse(response.output_text) as {
      merchant: string | null;
      purchased_at: string | null;
      purchase_channel: "IN_STORE" | "ONLINE" | "DELIVERY" | "UNKNOWN";
      dining_cuisine: string;
      dining_venue_type: string;
      dining_service_style: string;
      total: number | null;
      tax: number | null;
      address: string | null;
      city: string | null;
      region: string | null;
      postal_code: string | null;
      country: string | null;
      raw_text: string;
      confidence: number;
      items: Array<{
        name: string;
        quantity: number | null;
        price: number;
        category_id: string;
      }>;
    };
    const receiptContext =
      `${extracted.merchant ?? ""} ${extracted.raw_text}`.toLowerCase();
    const diningReceipt =
      /\b(restaurant|ristorante|trattoria|pizzeria|cafe|café|diner|bistro|grill|kitchen|barbecue|bbq|steakhouse|taqueria|sushi|ramen|sandwich|deli|wich|food truck|takeout|dine-in|server|gratuity)\b/.test(
        receiptContext,
      );
    const diningFallback = choices.find(
      (choice) => choice.path === "Dining › Food Items › Other Prepared Food",
    );
    if (diningReceipt && diningFallback)
      extracted.items = extracted.items.map((item) =>
        choices
          .find((choice) => choice.id === item.category_id)
          ?.path.startsWith("Dining › ")
          ? item
          : { ...item, category_id: diningFallback.id },
      );
    const purchasedAt = extracted.purchased_at
      ? new Date(extracted.purchased_at)
      : null;
    const validDate =
      purchasedAt && !Number.isNaN(purchasedAt.getTime()) ? purchasedAt : null;
    const candidates = await prisma.transaction.findMany({
      where: { userId: receipt.userId, type: "EXPENSE", receipt: null },
      orderBy: { transactedAt: "desc" },
      take: 100,
    });
    let best: { id: string; score: number } | null = null;
    for (const transaction of candidates) {
      let score = 0;
      if (extracted.total !== null) {
        const delta = Math.abs(
          Math.abs(Number(transaction.amount)) - extracted.total,
        );
        score += delta < 0.01 ? 0.55 : delta < 1 ? 0.25 : 0;
      }
      if (validDate) {
        const days =
          Math.abs(transaction.transactedAt.getTime() - validDate.getTime()) /
          86400000;
        score += days <= 1 ? 0.25 : days <= 3 ? 0.12 : 0;
      }
      if (extracted.merchant)
        score +=
          similarity(
            extracted.merchant,
            transaction.merchantNormalized ?? transaction.merchantRaw,
          ) * 0.2;
      if (!best || score > best.score) best = { id: transaction.id, score };
    }
    const match = best && best.score >= 0.65 ? best : null;
    await prisma.$transaction(async (database) => {
      await database.receiptItem.deleteMany({ where: { receiptId: id } });
      await database.receipt.update({
        where: { id },
        data: {
          merchant: extracted.merchant,
          rawText: extracted.raw_text,
          purchasedAt: validDate,
          total: extracted.total,
          tax: extracted.tax,
          purchaseChannel: extracted.purchase_channel,
          diningCuisine: extracted.dining_cuisine,
          diningVenueType: extracted.dining_venue_type,
          diningServiceStyle: extracted.dining_service_style,
          confidence: extracted.confidence,
          locationAddress: extracted.address,
          locationCity: extracted.city,
          locationRegion: extracted.region,
          locationPostalCode: extracted.postal_code,
          locationCountry: extracted.country,
          extractedData: extracted,
          analysisConsentAt: new Date(),
          transactionId: match?.id ?? null,
          matchConfidence: match?.score ?? null,
          status: match ? "POTENTIAL_MATCH" : "UNMATCHED",
          items: {
            create: extracted.items.map((item) => ({
              rawName: item.name,
              normalizedName: item.name,
              quantity: item.quantity,
              price: item.price,
              categoryId: categoriesById.has(item.category_id)
                ? item.category_id
                : null,
            })),
          },
        },
      });
    });
    return NextResponse.json({
      analyzed: true,
      matched: Boolean(match),
      matchConfidence: match?.score ?? null,
    });
  } catch (error) {
    console.error("Receipt analysis error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Receipt analysis failed.",
      },
      { status: 502 },
    );
  }
}
