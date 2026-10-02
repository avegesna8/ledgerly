import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};
type Place = {
  id?: string;
  formattedAddress?: string;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: AddressComponent[];
  error?: { message?: string };
};
const component = (
  components: AddressComponent[] | undefined,
  type: string,
  short = false,
) =>
  components?.find((entry) => entry.types?.includes(type))?.[
    short ? "shortText" : "longText"
  ] ?? null;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const entityType = body?.entityType;
  const entityId = typeof body?.entityId === "string" ? body.entityId : "";
  const placeId = typeof body?.placeId === "string" ? body.placeId : "";
  if (!["transaction", "receipt"].includes(entityType) || !entityId || !placeId)
    return NextResponse.json(
      { error: "Choose a valid place and record." },
      { status: 400 },
    );
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY is not configured." },
      { status: 503 },
    );
  const user = await prisma.user.findUnique({
    where: { email: "alex@ledgerly.local" },
  });
  if (!user)
    return NextResponse.json(
      { error: "Local user not found." },
      { status: 404 },
    );
  const existing =
    entityType === "transaction"
      ? await prisma.transaction.findFirst({
          where: { id: entityId, userId: user.id },
        })
      : await prisma.receipt.findFirst({
          where: { id: entityId, userId: user.id },
        });
  if (!existing)
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,formattedAddress,addressComponents,location,googleMapsUri",
      },
    },
  );
  const place = (await response.json()) as Place;
  if (!response.ok || !place.id)
    return NextResponse.json(
      { error: place.error?.message ?? "Could not load that place." },
      { status: 502 },
    );
  const data = {
    locationAddress: place.formattedAddress ?? null,
    locationCity:
      component(place.addressComponents, "locality") ??
      component(place.addressComponents, "postal_town"),
    locationRegion: component(
      place.addressComponents,
      "administrative_area_level_1",
      true,
    ),
    locationPostalCode: component(place.addressComponents, "postal_code"),
    locationCountry: component(place.addressComponents, "country", true),
    locationLatitude: place.location?.latitude ?? null,
    locationLongitude: place.location?.longitude ?? null,
    locationSource: "GOOGLE_PLACES",
    locationPlaceId: place.id,
    locationMapsUrl: place.googleMapsUri ?? null,
  };
  if (entityType === "transaction")
    await prisma.transaction.update({ where: { id: entityId }, data });
  else await prisma.receipt.update({ where: { id: entityId }, data });
  await prisma.auditLog.create({
    data: {
      entityType: entityType === "transaction" ? "Transaction" : "Receipt",
      entityId,
      action: "LOCATION_CONFIRMED",
      actorType: "USER",
      after: {
        placeId: place.id,
        address: place.formattedAddress,
        source: "GOOGLE_PLACES",
      },
    },
  });
  return NextResponse.json({
    confirmed: true,
    address: place.formattedAddress,
    mapsUrl: place.googleMapsUri,
  });
}
