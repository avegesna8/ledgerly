import { CountryCode } from "plaid";
import { NextResponse } from "next/server";
import { plaid } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import { syncInvestmentData, upsertPlaidAccounts } from "@/lib/plaid-data";

export async function POST(request: Request) {
  const body = await request.json().catch(()=>null);
  const updateConnectionId = typeof body?.connectionId === "string" ? body.connectionId : null;
  if (!body?.publicToken && !updateConnectionId) return NextResponse.json({ error:"Missing Plaid connection details." }, { status:400 });
  const user = await prisma.user.findUnique({ where:{ email:"alex@ledgerly.local" } });
  if (!user) return NextResponse.json({ error:"Local user not found." }, { status:404 });
  try {
    const existingConnection = updateConnectionId
      ? await prisma.integrationConnection.findFirst({ where: { id:updateConnectionId, userId:user.id, provider:"PLAID" } })
      : null;
    if (updateConnectionId && !existingConnection) return NextResponse.json({ error:"Plaid connection not found." }, { status:404 });
    const exchange = existingConnection
      ? null
      : await plaid.itemPublicTokenExchange({ public_token:body.publicToken });
    const accessToken = existingConnection
      ? decryptToken(existingConnection.encryptedAccessToken)
      : exchange!.data.access_token;
    const itemId = existingConnection?.providerConnectionId ?? exchange!.data.item_id;
    const accountsResponse = await plaid.accountsGet({ access_token:accessToken });
    const selectedIds = Array.isArray(body.selectedAccountIds) ? new Set(body.selectedAccountIds.filter((id: unknown): id is string => typeof id === "string")) : null;
    const selectedAccounts = selectedIds?.size ? accountsResponse.data.accounts.filter((account) => selectedIds.has(account.account_id)) : accountsResponse.data.accounts;
    const institutionId = accountsResponse.data.item.institution_id ?? null;
    let institutionName = body.institutionName ?? "Connected institution";
    if (institutionId) {
      const institution = await plaid.institutionsGetById({ institution_id:institutionId, country_codes:[CountryCode.Us] });
      institutionName = institution.data.institution.name;
    }
    const requestedProduct = body?.mode === "investment" || body?.addInvestments === true ? "INVESTMENTS" : "TRANSACTIONS";
    const connection = await prisma.integrationConnection.upsert({
      where:{ provider_providerConnectionId:{ provider:"PLAID", providerConnectionId:itemId } },
      update:{ encryptedAccessToken:encryptToken(accessToken), institutionId, institutionName, status:"ACTIVE", needsAttention:false, newAccountsAvailable:false, products:{ set:[...new Set([...(existingConnection?.products ?? []), requestedProduct])] } },
      create:{ userId:user.id, provider:"PLAID", providerConnectionId:itemId, encryptedAccessToken:encryptToken(accessToken), institutionId, institutionName, products:[requestedProduct] },
    });
    const savedAccounts = await upsertPlaidAccounts({ userId:user.id, connection, accounts:selectedAccounts });
    const visibleProviderIds = new Set(accountsResponse.data.accounts.map((account) => account.account_id));
    await prisma.financialAccount.updateMany({
      where:{ integrationId:connection.id, providerAccountId:{ notIn:[...visibleProviderIds] } },
      data:{ isActive:false },
    });
    let investmentResult = { holdings:0, investmentTransactions:0 };
    if (body?.mode === "investment" || body?.addInvestments === true || selectedAccounts.some((account) => account.type === "investment")) {
      try {
        investmentResult = await syncInvestmentData(connection, user.id);
      } catch (investmentError) {
        console.error("Plaid investments initialization error", investmentError);
      }
    }
    return NextResponse.json({ connectionId:connection.id, accounts:savedAccounts.length, ...investmentResult });
  } catch (error) {
    console.error("Plaid exchange error", error);
    return NextResponse.json({ error:"Plaid connection could not be saved." }, { status:502 });
  }
}
