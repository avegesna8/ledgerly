import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name =
    typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const parentId =
    typeof body?.parentId === "string" && body.parentId ? body.parentId : null;
  if (!name || name.length > 60)
    return NextResponse.json(
      { error: "Enter a category name up to 60 characters." },
      { status: 400 },
    );
  const user = await prisma.user.findUnique({
    where: { email: "alex@ledgerly.local" },
  });
  if (!user)
    return NextResponse.json(
      { error: "Local user not found." },
      { status: 404 },
    );
  const parent = parentId
    ? await prisma.category.findFirst({
        where: { id: parentId, userId: user.id },
      })
    : null;
  if (parentId && !parent)
    return NextResponse.json(
      { error: "Parent category not found." },
      { status: 404 },
    );
  const existing = await prisma.category.findFirst({
    where: {
      userId: user.id,
      parentId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (existing)
    return NextResponse.json({
      category: {
        id: existing.id,
        name: existing.name,
        parentId: existing.parentId,
      },
      existing: true,
    });
  const category = await prisma.category.create({
    data: { userId: user.id, parentId, name, isActive: true, isSystem: false },
  });
  await prisma.auditLog.create({
    data: {
      entityType: "Category",
      entityId: category.id,
      action: "CUSTOM_CATEGORY_CREATED",
      actorType: "USER",
      after: { name, parentId },
    },
  });
  return NextResponse.json(
    {
      category: {
        id: category.id,
        name: category.name,
        parentId: category.parentId,
      },
    },
    { status: 201 },
  );
}
