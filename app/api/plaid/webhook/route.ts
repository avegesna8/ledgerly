import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const itemId = typeof body?.item_id === "string" ? body.item_id : null;
  const webhookCode = typeof body?.webhook_code === "string" ? body.webhook_code : null;
  if (!itemId || !webhookCode) return NextResponse.json({ received: true });

  const connection = await prisma.integrationConnection.findUnique({
    where: { provider_providerConnectionId: { provider: "PLAID", providerConnectionId: itemId } },
  });
  if (!connection) return NextResponse.json({ received: true });

  const consentExpiration = typeof body?.consent_expiration_time === "string"
    ? new Date(body.consent_expiration_time)
    : undefined;
  const newAccountsAvailable = webhookCode === "NEW_ACCOUNTS_AVAILABLE";
  const needsAttention = ["ITEM_LOGIN_REQUIRED", "PENDING_EXPIRATION", "PENDING_DISCONNECT"].includes(webhookCode);
  await prisma.$transaction([
    prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        ...(newAccountsAvailable ? { newAccountsAvailable: true } : {}),
        ...(needsAttention ? { needsAttention: true } : {}),
        ...(consentExpiration && !Number.isNaN(consentExpiration.getTime())
          ? { consentExpiresAt: consentExpiration }
          : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "IntegrationConnection",
        entityId: connection.id,
        action: `PLAID_${webhookCode}`,
        actorType: "INTEGRATION",
        after: JSON.parse(JSON.stringify(body)),
      },
    }),
  ]);
  return NextResponse.json({ received: true });
}
