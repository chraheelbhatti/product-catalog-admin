import { NextResponse } from "next/server";

import { google } from "googleapis";

import { prisma } from "@/lib/prisma";

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
};

function getServiceAccountFromEnv(): ServiceAccountJson {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;

  const jsonText = raw
    ? raw
    : b64
      ? Buffer.from(b64, "base64").toString("utf8")
      : null;

  if (!jsonText) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 env var."
    );
  }

  const parsed = JSON.parse(jsonText) as ServiceAccountJson;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid service account JSON (missing client_email/private_key).");
  }

  return parsed;
}

function normalizeHeader(h: unknown) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function parseBool(value: string | undefined) {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return undefined;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<{
    spreadsheetId: string;
    range: string;
  }>;

  const spreadsheetId = body.spreadsheetId ?? process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const range = body.range ?? process.env.GOOGLE_SHEETS_RANGE ?? "Products!A1:Z";

  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "Missing spreadsheetId (body.spreadsheetId or GOOGLE_SHEETS_SPREADSHEET_ID)." },
      { status: 400 }
    );
  }

  const sa = getServiceAccountFromEnv();

  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const values = res.data.values ?? [];

  if (values.length < 2) {
    return NextResponse.json({ imported: 0, skipped: 0, message: "No rows to import." });
  }

  const headers = values[0].map(normalizeHeader);
  const idx = (name: string) => headers.indexOf(normalizeHeader(name));

  // Zee Ordering sheet mapping (case-insensitive, spaces ignored)
  const skuIdx = idx("skucode");
  const nameIdx = idx("remark");

  if (skuIdx === -1 || nameIdx === -1) {
    return NextResponse.json(
      {
        error:
          "Sheet must have header columns at least: SKUCode, Remark. Optional: BrandName, MRP, Category, StockQty, ImagePath, Code, ItemName, SuppName, MinQty.",
      },
      { status: 400 }
    );
  }

  const brandIdx = idx("brandname");
  const mrpIdx = idx("mrp");
  const categoryIdx = idx("category");
  const stockQtyIdx = idx("stockqty");
  const imagePathIdx = idx("imagepath");

  const codeIdx = idx("code");
  const itemNameIdx = idx("itemname");
  const suppNameIdx = idx("suppname");
  const minQtyIdx = idx("minqty");

  const rows = values.slice(1);

  let imported = 0;
  let skipped = 0;

  const batchSize = 250;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const ops = batch
      .map((r) => {
        const sku = String(r[skuIdx] ?? "").trim();
        const name = String(r[nameIdx] ?? "").trim();

        if (!sku || !name) {
          skipped += 1;
          return null;
        }

        const brand = brandIdx === -1 ? undefined : String(r[brandIdx] ?? "").trim() || undefined;

        const priceRaw = mrpIdx === -1 ? undefined : String(r[mrpIdx] ?? "").trim();
        const price = priceRaw ? priceRaw : undefined; // Prisma Decimal accepts string/number.

        const category =
          categoryIdx === -1 ? undefined : String(r[categoryIdx] ?? "").trim() || undefined;

        const stockRaw = stockQtyIdx === -1 ? undefined : String(r[stockQtyIdx] ?? "").trim();
        const stock = stockRaw ? Number.parseInt(stockRaw, 10) : undefined;

        const imageUrl =
          imagePathIdx === -1 ? undefined : String(r[imagePathIdx] ?? "").trim() || undefined;

        const code = codeIdx === -1 ? undefined : String(r[codeIdx] ?? "").trim() || undefined;
        const itemName =
          itemNameIdx === -1 ? undefined : String(r[itemNameIdx] ?? "").trim() || undefined;
        const supplierName =
          suppNameIdx === -1 ? undefined : String(r[suppNameIdx] ?? "").trim() || undefined;

        const minQtyRaw = minQtyIdx === -1 ? undefined : String(r[minQtyIdx] ?? "").trim();
        const minQty = minQtyRaw ? Number.parseInt(minQtyRaw, 10) : undefined;

        imported += 1;

        return prisma.product.upsert({
          where: { sku },
          create: {
            sku,
            name,
            brand,
            price,
            category,
            stock: Number.isFinite(stock) ? stock : undefined,
            imageUrl,
            code,
            itemName,
            supplierName,
            minQty: Number.isFinite(minQty) ? minQty : undefined,
          },
          update: {
            name,
            brand,
            price,
            category,
            stock: Number.isFinite(stock) ? stock : undefined,
            imageUrl,
            code,
            itemName,
            supplierName,
            minQty: Number.isFinite(minQty) ? minQty : undefined,
          },
        });
      })
      .filter(Boolean);

    // Execute each batch in a single transaction.
    // Note: for very large sheets, you may want a background job/queue; this is a skeleton.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(ops as any);
  }

  return NextResponse.json({ imported, skipped, spreadsheetId, range });
}
