import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

type GoogleConnection = {
  id: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: Date | null;
};

export async function googleAccessToken(connection: GoogleConnection) {
  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptToken(connection.encryptedAccessToken);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: decryptToken(connection.encryptedRefreshToken),
      grant_type: "refresh_token",
    }),
  });
  const result = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description ?? "Could not refresh Google access.");
  }

  await prisma.receiptSourceConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptToken(result.access_token),
      tokenExpiresAt: result.expires_in ? new Date(Date.now() + result.expires_in * 1000) : null,
      status: "ACTIVE",
    },
  });
  return result.access_token;
}
