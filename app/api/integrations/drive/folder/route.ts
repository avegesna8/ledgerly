import { NextResponse } from "next/server";
import { googleAccessToken } from "@/lib/google-access-token";
import { prisma } from "@/lib/prisma";

function folderId(value: string) {
  const match = value.trim().match(/(?:\/folders\/|^)([-\w]{10,})(?:[/?#]|$)/);
  return match?.[1];
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const id = folderId(body?.folder ?? "");
  if (!id) return NextResponse.json({ error: "Paste a valid Google Drive folder link or folder ID." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: "alex@ledgerly.local" } });
  if (!user) return NextResponse.json({ error: "Local user not found." }, { status: 404 });
  const connection = await prisma.receiptSourceConnection.findFirst({ where: { userId: user.id, provider: "GOOGLE_DRIVE", status: "ACTIVE" } });
  if (!connection) return NextResponse.json({ error: "Connect Google Drive first." }, { status: 404 });

  try {
    const token = await googleAccessToken(connection);
    const params = new URLSearchParams({ fields: "id,name,mimeType,trashed", supportsAllDrives: "true" });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const folder = await response.json() as { id?: string; name?: string; mimeType?: string; trashed?: boolean; error?: { message?: string } };
    if (!response.ok) throw new Error(folder.error?.message ?? "Could not access that Drive folder.");
    if (folder.mimeType !== "application/vnd.google-apps.folder" || folder.trashed) throw new Error("That link does not point to an active Google Drive folder.");
    await prisma.receiptSourceConnection.update({ where: { id: connection.id }, data: { configuration: { folderId: id, folderName: folder.name ?? "Receipt folder" }, status: "ACTIVE" } });
    return NextResponse.json({ folderId: id, folderName: folder.name });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not configure the Drive folder." }, { status: 502 });
  }
}
