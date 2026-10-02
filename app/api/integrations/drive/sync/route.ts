import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import convertHeic from "heic-convert";
import sharp from "sharp";
import { googleAccessToken } from "@/lib/google-access-token";
import { prisma } from "@/lib/prisma";
import { isTrackedSourceTime } from "@/lib/tracking";

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const heicTypes = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
type DriveConfiguration = { folderId?: string; folderName?: string };
type DriveFile = { id: string; name: string; mimeType: string; size?: string; createdTime?: string; modifiedTime?: string; capabilities?: { canDownload?: boolean } };

export async function POST() {
  const user = await prisma.user.findUnique({ where: { email: "alex@ledgerly.local" } });
  if (!user) return NextResponse.json({ error: "Local user not found." }, { status: 404 });
  const connection = await prisma.receiptSourceConnection.findFirst({ where: { userId: user.id, provider: "GOOGLE_DRIVE", status: "ACTIVE" } });
  if (!connection) return NextResponse.json({ error: "Connect Google Drive first." }, { status: 404 });
  const configuration = connection.configuration as DriveConfiguration | null;
  if (!configuration?.folderId) return NextResponse.json({ error: "Choose a Google Drive receipt folder first." }, { status: 400 });

  try {
    const token = await googleAccessToken(connection);
    let pageToken: string | undefined;
    let scanned = 0;
    let imported = 0;
    let duplicates = 0;
    let unsupported = 0;
    let beforeTrackingStartSkipped = 0;
    const skipped: Array<{ name: string; mimeType: string; reason: string }> = [];
    do {
      const params = new URLSearchParams({
        q: `'${configuration.folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
        fields: "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,capabilities(canDownload))",
        pageSize: "1000",
        spaces: "drive",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const listResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const list = await listResponse.json() as { files?: DriveFile[]; nextPageToken?: string; error?: { message?: string } };
      if (!listResponse.ok) throw new Error(list.error?.message ?? "Could not scan the Drive folder.");
      for (const file of list.files ?? []) {
        scanned++;
        if (!isTrackedSourceTime(file.createdTime ?? file.modifiedTime, user.trackingStartedAt)) { beforeTrackingStartSkipped++; continue; }
        const sourceExtension = path.extname(file.name).toLowerCase();
        const isHeic = heicTypes.has(file.mimeType) || sourceExtension === ".heic" || sourceExtension === ".heif";
        if (!allowed.has(file.mimeType) && !isHeic) { unsupported++; skipped.push({ name:file.name,mimeType:file.mimeType,reason:"unsupported file type" }); continue; }
        if (file.capabilities?.canDownload === false) { unsupported++; skipped.push({ name:file.name,mimeType:file.mimeType,reason:"Google Drive blocked downloading" }); continue; }
        if (Number(file.size ?? 0) > 20 * 1024 * 1024) { unsupported++; skipped.push({ name:file.name,mimeType:file.mimeType,reason:"larger than 20 MB" }); continue; }
        if (await prisma.receipt.findFirst({ where: { source: "GOOGLE_DRIVE", sourceExternalId: file.id } })) { duplicates++; continue; }
        const download = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
        if (!download.ok) { unsupported++; skipped.push({ name:file.name,mimeType:file.mimeType,reason:`download failed (${download.status})` }); continue; }
        const sourceBytes = Buffer.from(await download.arrayBuffer());
        if (sourceBytes.length > 20 * 1024 * 1024) { unsupported++; continue; }
        const checksum = createHash("sha256").update(sourceBytes).digest("hex");
        if (await prisma.receipt.findUnique({ where: { userId_checksum: { userId: user.id, checksum } } })) { duplicates++; continue; }
        let bytes = sourceBytes;
        let mimeType = file.mimeType;
        let originalFilename = file.name;
        let extension = sourceExtension || ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf" }[file.mimeType] ?? "");
        if (isHeic) {
          try {
            bytes = await sharp(sourceBytes).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
          } catch (conversionError) {
            console.warn(`Native HEIC conversion unavailable for Drive file ${file.id}; using the WASM decoder.`, conversionError);
            try {
              bytes = Buffer.from(await convertHeic({ buffer: sourceBytes, format: "JPEG", quality: 0.92 }));
            } catch (fallbackError) {
              console.error(`Could not convert Drive HEIC file ${file.id}`, fallbackError);
              unsupported++;
              skipped.push({ name:file.name,mimeType:file.mimeType,reason:"HEIC conversion failed" });
              continue;
            }
          }
          mimeType = "image/jpeg";
          extension = ".jpg";
          originalFilename = `${path.basename(file.name, sourceExtension)}.jpg`;
        }
        const storageKey = `${user.id}/${randomUUID()}${extension}`;
        const root = path.join(process.cwd(), "storage", "receipts");
        await mkdir(path.dirname(path.join(root, storageKey)), { recursive: true });
        await writeFile(path.join(root, storageKey), bytes, { flag: "wx" });
        await prisma.receipt.create({ data: { userId: user.id, originalUrl: `/api/receipts/file/${storageKey}`, storageKey, originalFilename, mimeType, source: "GOOGLE_DRIVE", sourceExternalId: file.id, checksum, extractedData: isHeic ? { sourceFilename: file.name, sourceMimeType: file.mimeType, convertedTo: "image/jpeg" } : undefined } });
        imported++;
      }
      pageToken = list.nextPageToken;
    } while (pageToken);
    await prisma.receiptSourceConnection.update({ where: { id: connection.id }, data: { lastSyncedAt: new Date(), status: "ACTIVE" } });
    return NextResponse.json({ folderName: configuration.folderName, scanned, imported, duplicates, unsupported, beforeTrackingStartSkipped, skipped });
  } catch (error) {
    console.error("Google Drive receipt sync error", error);
    await prisma.receiptSourceConnection.update({ where: { id: connection.id }, data: { status: "ERROR" } });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Drive scan failed." }, { status: 502 });
  }
}
