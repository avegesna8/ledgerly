import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  diningAttributeOptions,
  type DiningAttribute,
} from "@/lib/dining-attributes";

const attributes = new Set(Object.keys(diningAttributeOptions));
const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

export async function GET() {
  const user = await prisma.user.findUnique({
    where: { email: "alex@ledgerly.local" },
  });
  if (!user)
    return NextResponse.json(
      { error: "Local user not found." },
      { status: 404 },
    );
  const options = await prisma.customAttributeOption.findMany({
    where: { userId: user.id, scope: "DINING", isActive: true },
    orderBy: [{ attribute: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({
    options: options.map((option) => ({
      id: option.id,
      attribute: option.attribute,
      label: option.label,
      value: `CUSTOM:${option.label}`,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const attribute = typeof body?.attribute === "string" ? body.attribute : "";
  const label =
    typeof body?.label === "string"
      ? body.label.trim().replace(/\s+/g, " ")
      : "";
  if (!attributes.has(attribute) || !label || label.length > 80)
    return NextResponse.json(
      { error: "Enter a custom value up to 80 characters." },
      { status: 400 },
    );
  const systemValues = diningAttributeOptions[attribute as DiningAttribute];
  const duplicateSystem = systemValues.find(
    (value) => value.replaceAll("_", " ").toLowerCase() === normalize(label),
  );
  if (duplicateSystem)
    return NextResponse.json({
      option: { attribute, label, value: duplicateSystem },
      existing: true,
    });
  const user = await prisma.user.findUnique({
    where: { email: "alex@ledgerly.local" },
  });
  if (!user)
    return NextResponse.json(
      { error: "Local user not found." },
      { status: 404 },
    );
  const option = await prisma.customAttributeOption.upsert({
    where: {
      userId_scope_attribute_normalizedLabel: {
        userId: user.id,
        scope: "DINING",
        attribute,
        normalizedLabel: normalize(label),
      },
    },
    update: { isActive: true },
    create: {
      userId: user.id,
      scope: "DINING",
      attribute,
      label,
      normalizedLabel: normalize(label),
    },
  });
  return NextResponse.json({
    option: {
      id: option.id,
      attribute,
      label: option.label,
      value: `CUSTOM:${option.label}`,
    },
  });
}
