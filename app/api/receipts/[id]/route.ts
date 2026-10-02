import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diningValue } from "@/lib/dining-attributes";

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const optionalNumber = (value: unknown) =>
  value === "" || value === null || value === undefined ? null : Number(value);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!receipt)
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  const action = body?.action;
  if (action === "confirm") {
    if (!receipt.transactionId)
      return NextResponse.json(
        { error: "Choose a transaction before confirming." },
        { status: 400 },
      );
    await prisma.$transaction([
      prisma.receipt.update({ where: { id }, data: { status: "CONFIRMED" } }),
      prisma.transaction.update({
        where: { id: receipt.transactionId },
        data: {
          diningCuisine: receipt.diningCuisine,
          diningVenueType: receipt.diningVenueType,
          diningServiceStyle: receipt.diningServiceStyle,
        },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "Receipt",
          entityId: id,
          action: "MATCH_CONFIRMED",
          actorType: "USER",
          after: { transactionId: receipt.transactionId },
        },
      }),
    ]);
    return NextResponse.json({ confirmed: true });
  }
  if (action === "reject") {
    await prisma.receipt.update({
      where: { id },
      data: { status: "UNMATCHED", transactionId: null, matchConfidence: null },
    });
    return NextResponse.json({ rejected: true });
  }
  if (action === "dismiss") {
    await prisma.$transaction([
      prisma.receipt.update({
        where: { id },
        data: {
          status: "REJECTED",
          transactionId: null,
          matchConfidence: null,
        },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "Receipt",
          entityId: id,
          action: "DISMISSED",
          actorType: "USER",
          before: {
            status: receipt.status,
            transactionId: receipt.transactionId,
          },
          after: { status: "REJECTED" },
        },
      }),
    ]);
    return NextResponse.json({ dismissed: true });
  }
  if (action === "restore") {
    if (receipt.status !== "REJECTED")
      return NextResponse.json(
        { error: "Only dismissed receipts can be restored." },
        { status: 409 },
      );
    await prisma.$transaction([
      prisma.receipt.update({ where: { id }, data: { status: "UNMATCHED" } }),
      prisma.auditLog.create({
        data: {
          entityType: "Receipt",
          entityId: id,
          action: "RESTORED",
          actorType: "USER",
          before: { status: receipt.status },
          after: { status: "UNMATCHED" },
        },
      }),
    ]);
    return NextResponse.json({ restored: true });
  }
  if (action === "link") {
    const transactionId = optionalText(body?.transactionId);
    if (!transactionId)
      return NextResponse.json(
        { error: "Choose a transaction to link." },
        { status: 400 },
      );
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: receipt.userId },
      include: { receipt: true },
    });
    if (!transaction)
      return NextResponse.json(
        { error: "Transaction not found." },
        { status: 404 },
      );
    if (transaction.receipt && transaction.receipt.id !== id)
      return NextResponse.json(
        { error: "That transaction already has a receipt attached." },
        { status: 409 },
      );
    await prisma.$transaction([
      prisma.receipt.update({
        where: { id },
        data: { transactionId, status: "POTENTIAL_MATCH", matchConfidence: 1 },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "Receipt",
          entityId: id,
          action: "MATCH_SELECTED",
          actorType: "USER",
          before: { transactionId: receipt.transactionId },
          after: { transactionId },
        },
      }),
    ]);
    return NextResponse.json({ linked: true });
  }

  const merchant = optionalText(body?.merchant);
  const total = optionalNumber(body?.total);
  const tax = optionalNumber(body?.tax);
  const purchasedAt = optionalText(body?.purchasedAt);
  const purchaseChannel = [
    "IN_STORE",
    "ONLINE",
    "DELIVERY",
    "UNKNOWN",
  ].includes(String(body?.purchaseChannel))
    ? String(body.purchaseChannel)
    : "UNKNOWN";
  const diningCuisine = diningValue(body?.diningCuisine, "cuisine");
  const diningVenueType = diningValue(body?.diningVenueType, "venueType");
  const diningServiceStyle = diningValue(
    body?.diningServiceStyle,
    "serviceStyle",
  );
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!merchant)
    return NextResponse.json(
      { error: "Merchant is required." },
      { status: 400 },
    );
  if (total === null || !Number.isFinite(total) || total < 0)
    return NextResponse.json(
      { error: "Enter a valid receipt total." },
      { status: 400 },
    );
  if (tax !== null && (!Number.isFinite(tax) || tax < 0))
    return NextResponse.json(
      { error: "Enter a valid tax amount." },
      { status: 400 },
    );
  const parsedDate = purchasedAt ? new Date(`${purchasedAt}T12:00:00Z`) : null;
  if (parsedDate && Number.isNaN(parsedDate.getTime()))
    return NextResponse.json(
      { error: "Enter a valid purchase date." },
      { status: 400 },
    );
  const categoryIds = items
    .map((item: { categoryId?: unknown }) => optionalText(item.categoryId))
    .filter((value: string | null): value is string => Boolean(value));
  const validCategories = await prisma.category.findMany({
    where: { id: { in: categoryIds }, isActive: true },
    select: { id: true },
  });
  const validCategoryIds = new Set(
    validCategories.map((category) => category.id),
  );
  const parsedItems: Array<{
    rawName: string;
    normalizedName: string;
    price: number;
    quantity: number | null;
    categoryId: string | null;
  }> = [];
  for (const item of items) {
    const name = optionalText(item?.name);
    const price = optionalNumber(item?.price);
    const quantity = optionalNumber(item?.quantity);
    const categoryId = optionalText(item?.categoryId);
    if (!name)
      return NextResponse.json(
        { error: "Every line item needs a description." },
        { status: 400 },
      );
    if (price === null || !Number.isFinite(price) || price < 0)
      return NextResponse.json(
        { error: `Enter a valid price for ${name}.` },
        { status: 400 },
      );
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0))
      return NextResponse.json(
        { error: `Enter a valid quantity for ${name}.` },
        { status: 400 },
      );
    if (categoryId && !validCategoryIds.has(categoryId))
      return NextResponse.json(
        { error: `Choose a valid category for ${name}.` },
        { status: 400 },
      );
    parsedItems.push({
      rawName: name,
      normalizedName: name,
      price,
      quantity,
      categoryId,
    });
  }
  const before = {
    merchant: receipt.merchant,
    purchasedAt: receipt.purchasedAt?.toISOString(),
    total: receipt.total?.toString(),
    tax: receipt.tax?.toString(),
    items: receipt.items.length,
  };
  await prisma.$transaction(async (database) => {
    await database.receiptItem.deleteMany({ where: { receiptId: id } });
    await database.receipt.update({
      where: { id },
      data: {
        merchant,
        purchasedAt: parsedDate,
        total,
        tax,
        purchaseChannel,
        diningCuisine,
        diningVenueType,
        diningServiceStyle,
        locationAddress: optionalText(body?.locationAddress),
        locationCity: optionalText(body?.locationCity),
        locationRegion: optionalText(body?.locationRegion),
        locationPostalCode: optionalText(body?.locationPostalCode),
        locationCountry: optionalText(body?.locationCountry),
        items: { create: parsedItems },
      },
    });
    await database.auditLog.create({
      data: {
        entityType: "Receipt",
        entityId: id,
        action: "USER_CORRECTION",
        actorType: "USER",
        before,
        after: {
          merchant,
          purchasedAt: parsedDate?.toISOString(),
          total,
          tax,
          items: parsedItems.length,
        },
      },
    });
  });
  return NextResponse.json({ updated: true });
}
