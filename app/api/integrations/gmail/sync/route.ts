import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import { looksLikeEmailReceipt } from "@/lib/email-receipt-detection";
import { isTrackedSourceTime } from "@/lib/tracking";

type GmailPart = {
  filename?: string;
  mimeType?: string;
  headers?: Array<{ name?: string; value?: string }>;
  body?: { attachmentId?: string; data?: string };
  parts?: GmailPart[];
};
const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

async function accessToken(connection: {
  id: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: Date | null;
}) {
  if (
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() > Date.now() + 60_000
  )
    return decryptToken(connection.encryptedAccessToken);
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
  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !result.access_token)
    throw new Error(
      result.error_description ?? "Could not refresh Gmail access.",
    );
  await prisma.receiptSourceConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptToken(result.access_token),
      tokenExpiresAt: result.expires_in
        ? new Date(Date.now() + result.expires_in * 1000)
        : null,
      status: "ACTIVE",
    },
  });
  return result.access_token;
}

function attachments(part: GmailPart, result: GmailPart[] = []) {
  if (
    part.body?.attachmentId &&
    part.filename &&
    part.mimeType &&
    allowed.has(part.mimeType)
  )
    result.push(part);
  for (const child of part.parts ?? []) attachments(child, result);
  return result;
}
function bodyParts(part: GmailPart, result: GmailPart[] = []) {
  if (
    part.body?.data &&
    (part.mimeType === "text/plain" || part.mimeType === "text/html")
  )
    result.push(part);
  for (const child of part.parts ?? []) bodyParts(child, result);
  return result;
}
function decodeBody(part: GmailPart) {
  return part.body?.data
    ? Buffer.from(part.body.data, "base64url").toString("utf8")
    : "";
}
function readableText(value: string, mimeType?: string) {
  if (mimeType !== "text/html") return value;
  return value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/tr>|<\/li>|<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
function header(part: GmailPart, name: string) {
  return (
    part.headers?.find(
      (entry) => entry.name?.toLowerCase() === name.toLowerCase(),
    )?.value ?? ""
  );
}
function gmailDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "/");
}
function safeTerm(value: string) {
  return value
    .replace(/[{}"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function safeFilename(value: string) {
  return (
    value
      .replace(/[^a-z0-9 _.-]/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100) || "Email receipt"
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const fullScan = body?.mode === "full_90_days";
  const recentScan = body?.mode === "last_5_days";
  const broadScan = fullScan || recentScan;
  const user = await prisma.user.findUnique({
    where: { email: "alex@ledgerly.local" },
  });
  if (!user)
    return NextResponse.json(
      { error: "Local user not found." },
      { status: 404 },
    );
  const connection = await prisma.receiptSourceConnection.findFirst({
    where: { userId: user.id, provider: "GMAIL", status: "ACTIVE" },
  });
  if (!connection)
    return NextResponse.json(
      { error: "Connect Gmail first." },
      { status: 404 },
    );
  try {
    const token = await accessToken(connection);
    const headers = { Authorization: `Bearer ${token}` };
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        status: { in: ["NEEDS_REVIEW", "PENDING"] },
        receipt: null,
      },
      orderBy: { transactedAt: "desc" },
      take: 50,
    });
    let imported = 0,
      duplicates = 0,
      unsupported = 0,
      searchedMessages = 0,
      emailBodiesImported = 0;
    const seenMessages = new Set<string>();
    const scanTargets = broadScan ? [null] : transactions;
    for (const transaction of scanTargets) {
      let query: string;
      if (transaction) {
        const start = new Date(transaction.transactedAt);
        start.setUTCDate(start.getUTCDate() - 4);
        const end = new Date(transaction.transactedAt);
        end.setUTCDate(end.getUTCDate() + 5);
        const normalized = safeTerm(
          transaction.merchantNormalized ?? transaction.merchantRaw,
        );
        const raw = safeTerm(transaction.merchantRaw);
        const merchantTerms = [normalized, raw]
          .filter(
            (value, index, array) => value && array.indexOf(value) === index,
          )
          .map((value) => `"${value}"`)
          .join(" ");
        if (!merchantTerms) continue;
        query = `after:${gmailDate(start)} before:${gmailDate(end)} {receipt invoice bill "order received" "order confirmation"} {${merchantTerms}}`;
      } else
        query = `${recentScan ? "newer_than:5d" : "newer_than:90d"} {receipt invoice bill "order received" "order confirmation"}`;
      if (user.trackingStartedAt) query += ` after:${Math.floor(user.trackingStartedAt.getTime() / 1000)}`;
      const params = new URLSearchParams({
        q: query,
        maxResults: broadScan ? "100" : "10",
      });
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        { headers },
      );
      const list = (await listResponse.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };
      if (!listResponse.ok)
        throw new Error(list.error?.message ?? "Could not search Gmail.");
      for (const message of list.messages ?? []) {
        if (seenMessages.has(message.id)) continue;
        seenMessages.add(message.id);
        searchedMessages++;
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
          { headers },
        );
        const gmailMessage = (await messageResponse.json()) as {
          payload?: GmailPart;
          internalDate?: string;
        };
        if (!messageResponse.ok || !gmailMessage.payload) continue;
        if (!isTrackedSourceTime(gmailMessage.internalDate, user.trackingStartedAt)) continue;
        let handledAttachment = false;
        for (const part of attachments(gmailMessage.payload)) {
          if (
            broadScan &&
            !/(receipt|invoice|bill|order|statement)/i.test(part.filename ?? "")
          ) {
            unsupported++;
            continue;
          }
          handledAttachment = true;
          const attachmentId = part.body?.attachmentId;
          if (!attachmentId) continue;
          const externalId = `${message.id}:${attachmentId}`;
          if (
            await prisma.receipt.findFirst({
              where: { source: "GMAIL", sourceExternalId: externalId },
            })
          ) {
            duplicates++;
            continue;
          }
          const attachmentResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}/attachments/${attachmentId}`,
            { headers },
          );
          const attachment = (await attachmentResponse.json()) as {
            data?: string;
          };
          if (!attachmentResponse.ok || !attachment.data) {
            unsupported++;
            continue;
          }
          const bytes = Buffer.from(attachment.data, "base64url");
          if (bytes.length > 20 * 1024 * 1024) {
            unsupported++;
            continue;
          }
          const checksum = createHash("sha256").update(bytes).digest("hex");
          if (
            await prisma.receipt.findUnique({
              where: { userId_checksum: { userId: user.id, checksum } },
            })
          ) {
            duplicates++;
            continue;
          }
          const extension =
            path.extname(part.filename ?? "").toLowerCase() ||
            ({
              "image/jpeg": ".jpg",
              "image/png": ".png",
              "image/webp": ".webp",
              "application/pdf": ".pdf",
            }[part.mimeType ?? ""] ??
              "");
          const storageKey = `${user.id}/${randomUUID()}${extension}`;
          const root = path.join(process.cwd(), "storage", "receipts");
          await mkdir(path.dirname(path.join(root, storageKey)), {
            recursive: true,
          });
          await writeFile(path.join(root, storageKey), bytes, { flag: "wx" });
          await prisma.receipt.create({
            data: {
              userId: user.id,
              originalUrl: `/api/receipts/file/${storageKey}`,
              storageKey,
              originalFilename: part.filename ?? `gmail-receipt${extension}`,
              mimeType: part.mimeType ?? "application/octet-stream",
              source: "GMAIL",
              sourceExternalId: externalId,
              checksum,
            },
          });
          imported++;
        }
        if (handledAttachment) continue;
        const bodies = bodyParts(gmailMessage.payload);
        const preferred =
          bodies.find(
            (part) =>
              part.mimeType === "text/plain" && decodeBody(part).length > 100,
          ) ?? bodies.find((part) => part.mimeType === "text/html");
        if (!preferred) continue;
        const subject = header(gmailMessage.payload, "Subject");
        const sender = header(gmailMessage.payload, "From");
        const sentAt = header(gmailMessage.payload, "Date");
        const text = readableText(decodeBody(preferred), preferred.mimeType);
        if (!looksLikeEmailReceipt(subject, text)) continue;
        const externalId = `${message.id}:body`;
        if (
          await prisma.receipt.findFirst({
            where: { source: "GMAIL", sourceExternalId: externalId },
          })
        ) {
          duplicates++;
          continue;
        }
        const receiptText = [
          `Subject: ${subject}`,
          `From: ${sender}`,
          `Email date: ${sentAt}`,
          "",
          text,
        ].join("\n");
        const bytes = Buffer.from(receiptText, "utf8");
        if (bytes.length > 2 * 1024 * 1024) {
          unsupported++;
          continue;
        }
        const checksum = createHash("sha256").update(bytes).digest("hex");
        if (
          await prisma.receipt.findUnique({
            where: { userId_checksum: { userId: user.id, checksum } },
          })
        ) {
          duplicates++;
          continue;
        }
        const storageKey = `${user.id}/${randomUUID()}.txt`;
        const root = path.join(process.cwd(), "storage", "receipts");
        await mkdir(path.dirname(path.join(root, storageKey)), {
          recursive: true,
        });
        await writeFile(path.join(root, storageKey), bytes, { flag: "wx" });
        await prisma.receipt.create({
          data: {
            userId: user.id,
            originalUrl: `/api/receipts/file/${storageKey}`,
            storageKey,
            originalFilename: `${safeFilename(subject)}.txt`,
            mimeType: "text/plain",
            source: "GMAIL",
            sourceExternalId: externalId,
            checksum,
            rawText: receiptText,
            extractedData: {
              gmailMessageId: message.id,
              subject,
              sender,
              sentAt,
              source: "EMAIL_BODY",
            },
          },
        });
        imported++;
        emailBodiesImported++;
      }
    }
    const transactionSearches = broadScan
      ? []
      : transactions.map((transaction) => {
          const start = new Date(transaction.transactedAt);
          start.setUTCDate(start.getUTCDate() - 4);
          const end = new Date(transaction.transactedAt);
          end.setUTCDate(end.getUTCDate() + 4);
          return {
            merchant: transaction.merchantNormalized ?? transaction.merchantRaw,
            transactionDate: transaction.transactedAt
              .toISOString()
              .slice(0, 10),
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10),
          };
        });
    await prisma.receiptSourceConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date(), status: "ACTIVE" },
    });
    return NextResponse.json({
      mode: fullScan ? "full_90_days" : recentScan ? "last_5_days" : "targeted",
      transactionsScanned: broadScan ? 0 : transactions.length,
      transactionSearches,
      searched: searchedMessages,
      imported,
      emailBodiesImported,
      duplicates,
      unsupported,
    });
  } catch (error) {
    console.error("Gmail receipt sync error", error);
    await prisma.receiptSourceConnection.update({
      where: { id: connection.id },
      data: { status: "ERROR" },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gmail scan failed." },
      { status: 502 },
    );
  }
}
