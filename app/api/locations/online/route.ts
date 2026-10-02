import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const entityType = body?.entityType;
  const entityId = typeof body?.entityId === "string" ? body.entityId : "";

  if (!["transaction", "receipt"].includes(entityType) || !entityId) {
    return NextResponse.json(
      { error: "Choose a valid transaction or receipt." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: "alex@ledgerly.local" },
  });
  if (!user) {
    return NextResponse.json(
      { error: "Local user not found." },
      { status: 404 },
    );
  }

  const existing =
    entityType === "transaction"
      ? await prisma.transaction.findFirst({
          where: { id: entityId, userId: user.id },
        })
      : await prisma.receipt.findFirst({
          where: { id: entityId, userId: user.id },
        });
  if (!existing) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  const location = {
    locationAddress: null,
    locationCity: null,
    locationRegion: null,
    locationPostalCode: null,
    locationCountry: null,
    locationLatitude: null,
    locationLongitude: null,
    locationSource: "USER_ONLINE",
    locationPlaceId: null,
    locationMapsUrl: null,
  };

  if (entityType === "transaction") {
    await prisma.transaction.update({
      where: { id: entityId },
      data: { ...location, paymentChannel: "ONLINE" },
    });
  } else {
    await prisma.receipt.update({
      where: { id: entityId },
      data: { ...location, purchaseChannel: "ONLINE" },
    });
  }

  await prisma.auditLog.create({
    data: {
      entityType: entityType === "transaction" ? "Transaction" : "Receipt",
      entityId,
      action: "LOCATION_MARKED_ONLINE",
      actorType: "USER",
      after: { purchaseChannel: "ONLINE", source: "USER_ONLINE" },
    },
  });

  return NextResponse.json({ updated: true, purchaseChannel: "ONLINE" });
}
