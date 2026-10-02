import { CountryCode, Products, type LinkTokenCreateRequest } from "plaid";
import { NextResponse } from "next/server";
import { plaid } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/token-crypto";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === "investment" ? "investment" : body?.mode === "update" ? "update" : "bank";
  const user = await prisma.user.findUnique({ where:{ email:"alex@ledgerly.local" } });
  if (!user) return NextResponse.json({ error:"Local user not found." }, { status:404 });
  try {
    const linkRequest: LinkTokenCreateRequest = {
      user:{ client_user_id:user.id },
      client_name:"Ledgerly",
      country_codes:[CountryCode.Us],
      language:"en",
      ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {}),
      ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
    };
    let connectionId: string | undefined;
    if (mode === "update") {
      connectionId = typeof body?.connectionId === "string" ? body.connectionId : undefined;
      if (!connectionId) return NextResponse.json({ error:"Choose a connection to update." }, { status:400 });
      const connection = await prisma.integrationConnection.findFirst({
        where: { id: connectionId, userId: user.id, provider: "PLAID" },
      });
      if (!connection) return NextResponse.json({ error:"Plaid connection not found." }, { status:404 });
      linkRequest.access_token = decryptToken(connection.encryptedAccessToken);
      linkRequest.update = { account_selection_enabled: true };
      if (body?.addInvestments === true && !connection.products.includes("INVESTMENTS")) {
        linkRequest.additional_consented_products = [Products.Investments];
      }
    } else {
      linkRequest.products = [mode === "investment" ? Products.Investments : Products.Transactions];
      if (mode === "bank") linkRequest.additional_consented_products = [Products.Investments];
    }
    const response = await plaid.linkTokenCreate(linkRequest);
    return NextResponse.json({ linkToken:response.data.link_token, mode, connectionId });
  } catch (error) {
    console.error("Plaid link token error", error);
    const message = typeof error === "object" && error && "response" in error
      ? (error as { response?: { data?: { error_message?: string } } }).response?.data?.error_message
      : undefined;
    if (body?.addInvestments === true && typeof body?.connectionId === "string" && message?.toLowerCase().includes("investments not supported")) {
      const connection = await prisma.integrationConnection.findFirst({ where: { id:body.connectionId, userId:user.id } });
      if (connection && !connection.products.includes("INVESTMENTS_UNSUPPORTED")) {
        await prisma.integrationConnection.update({ where:{ id:connection.id }, data:{ products:{ set:[...new Set([...connection.products,"TRANSACTIONS","INVESTMENTS_UNSUPPORTED"])] } } });
      }
    }
    return NextResponse.json({ error:message ?? "Plaid could not create a connection session. Check your credentials and environment." }, { status:502 });
  }
}
