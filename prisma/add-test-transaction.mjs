import { PrismaClient } from "@prisma/client";
import { createDecipheriv } from "node:crypto";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const prisma = new PrismaClient();

function decryptToken(value) {
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("TOKEN_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(encryptionKey, "base64");
  const [iv, tag, encrypted] = value
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

const plaid = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  }),
);

try {
  if (process.env.PLAID_ENV !== "sandbox") {
    throw new Error("Test transactions can only be created when PLAID_ENV=sandbox.");
  }

  const user = await prisma.user.findUnique({ where: { email: "alex@ledgerly.local" } });
  if (!user) throw new Error("Local user not found.");

  const connection = await prisma.integrationConnection.findFirst({
    where: { userId: user.id, provider: "PLAID", status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!connection) throw new Error("No active Plaid connection found.");

  const today = new Date().toISOString().slice(0, 10);
  await plaid.sandboxTransactionsCreate({
    access_token: decryptToken(connection.encryptedAccessToken),
    transactions: [
      {
        date_transacted: today,
        date_posted: today,
        amount: 42.85,
        description: "Mario's Italian Restaurant",
        iso_currency_code: "USD",
      },
    ],
  });

  console.log(`Created Plaid Sandbox transaction: Mario's Italian Restaurant, $42.85, ${today}.`);
} finally {
  await prisma.$disconnect();
}
