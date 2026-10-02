import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/token-crypto";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie")?.match(/(?:^|; )drive_oauth_state=([^;]+)/)?.[1];
  if (!code || !state || !cookie || decodeURIComponent(cookie) !== state) return NextResponse.redirect(`${origin}/?drive=state_error`);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || `${origin}/api/integrations/drive/callback`;
  if (!clientId || !clientSecret) return NextResponse.redirect(`${origin}/?drive=config_error`);

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string };
    if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) throw new Error(tokens.error_description ?? "Google did not return the required Drive tokens.");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const profile = await profileResponse.json() as { email?: string };
    if (!profileResponse.ok || !profile.email) throw new Error("Could not read the Google profile.");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "alex@ledgerly.local" } });
    await prisma.receiptSourceConnection.upsert({
      where: { provider_externalAccountId: { provider: "GOOGLE_DRIVE", externalAccountId: profile.email } },
      update: {
        userId: user.id,
        displayName: profile.email,
        encryptedAccessToken: encryptToken(tokens.access_token),
        encryptedRefreshToken: encryptToken(tokens.refresh_token),
        scopes: tokens.scope?.split(" ") ?? [],
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        status: "ACTIVE",
      },
      create: {
        userId: user.id,
        provider: "GOOGLE_DRIVE",
        externalAccountId: profile.email,
        displayName: profile.email,
        encryptedAccessToken: encryptToken(tokens.access_token),
        encryptedRefreshToken: encryptToken(tokens.refresh_token),
        scopes: tokens.scope?.split(" ") ?? [],
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        status: "ACTIVE",
      },
    });
    const response = NextResponse.redirect(`${origin}/?drive=connected`);
    response.cookies.delete("drive_oauth_state");
    return response;
  } catch (error) {
    console.error("Google Drive OAuth error", error);
    return NextResponse.redirect(`${origin}/?drive=connection_error`);
  }
}
