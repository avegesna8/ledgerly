import { NextResponse } from "next/server";

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (query.length < 2)
    return NextResponse.json(
      { error: "Enter a merchant or address." },
      { status: 400 },
    );
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY is not configured." },
      { status: 503 },
    );
  const requestBody: Record<string, unknown> = {
    textQuery: query,
    pageSize: 5,
  };
  if (Number.isFinite(body?.latitude) && Number.isFinite(body?.longitude))
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: Number(body.latitude),
          longitude: Number(body.longitude),
        },
        radius: 25000,
      },
    };
  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri",
      },
      body: JSON.stringify(requestBody),
    },
  );
  const result = (await response.json()) as {
    places?: GooglePlace[];
    error?: { message?: string };
  };
  if (!response.ok)
    return NextResponse.json(
      { error: result.error?.message ?? "Google Places search failed." },
      { status: 502 },
    );
  return NextResponse.json({
    places: (result.places ?? []).map((place) => ({
      id: place.id,
      name: place.displayName?.text ?? "Unknown place",
      address: place.formattedAddress ?? "",
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
      mapsUrl: place.googleMapsUri,
    })),
  });
}
