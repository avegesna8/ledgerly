import { NextResponse } from "next/server";
import { classifyTransaction } from "@/lib/ai-classifier";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      user: { include: { categories: { where: { isActive: true } } } },
    },
  });
  if (!transaction)
    return NextResponse.json(
      { error: "Transaction not found." },
      { status: 404 },
    );
  const byId = new Map(
    transaction.user.categories.map((category) => [category.id, category]),
  );
  const parentIds = new Set(
    transaction.user.categories.flatMap((category) =>
      category.parentId ? [category.parentId] : [],
    ),
  );
  const pathFor = (categoryId: string) => {
    const parts: string[] = [];
    let current = byId.get(categoryId);
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      parts.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return parts.join(" › ");
  };
  const categories = transaction.user.categories
    .filter((category) => !parentIds.has(category.id))
    .map((category) => ({ id: category.id, path: pathFor(category.id) }));
  try {
    const suggestion = await classifyTransaction(
      {
        merchant: transaction.merchantNormalized ?? transaction.merchantRaw,
        description: transaction.merchantRaw,
        amount: Number(transaction.amount),
        date: transaction.transactedAt.toISOString().slice(0, 10),
      },
      categories,
    );
    const selected = byId.get(suggestion.categoryId);
    if (!selected)
      return NextResponse.json(
        { error: "The suggested category no longer exists." },
        { status: 409 },
      );
    await prisma.$transaction([
      prisma.aiClassification.create({
        data: {
          transactionId: id,
          suggestedCategoryId: suggestion.categoryId,
          confidence: suggestion.confidence,
          rationale: suggestion.rationale,
          model: suggestion.model,
        },
      }),
      prisma.transaction.update({
        where: { id },
        data: {
          categoryId: suggestion.categoryId,
          status: "NEEDS_REVIEW",
          diningCuisine: suggestion.diningCuisine,
          diningVenueType: suggestion.diningVenueType,
          diningServiceStyle: suggestion.diningServiceStyle,
        },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "Transaction",
          entityId: id,
          action: "AI_CATEGORY_SUGGESTED",
          actorType: "AI",
          before: { categoryId: transaction.categoryId },
          after: {
            categoryId: suggestion.categoryId,
            confidence: suggestion.confidence,
            model: suggestion.model,
          },
        },
      }),
    ]);
    return NextResponse.json({
      categoryId: suggestion.categoryId,
      categoryPath: categories.find(
        (category) => category.id === suggestion.categoryId,
      )?.path,
      diningCuisine: suggestion.diningCuisine,
      diningVenueType: suggestion.diningVenueType,
      diningServiceStyle: suggestion.diningServiceStyle,
      confidence: suggestion.confidence,
      rationale: suggestion.rationale,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Classification failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
