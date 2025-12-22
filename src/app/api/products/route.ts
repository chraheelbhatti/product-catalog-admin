import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function toInt(value: string | null, fallback: number) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") ?? "").trim();
  const brand = (searchParams.get("brand") ?? "").trim();
  const page = Math.max(1, toInt(searchParams.get("page"), 1));
  const pageSize = Math.min(200, Math.max(1, toInt(searchParams.get("pageSize"), 50)));

  const searchFilter = q
    ? {
        OR: [
          { sku: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { brand: { contains: q, mode: "insensitive" as const } },
          { code: { contains: q, mode: "insensitive" as const } },
          { itemName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const brandFilter = brand
    ? {
        brand: { equals: brand, mode: "insensitive" as const },
      }
    : undefined;

  const where = {
    ...(searchFilter ?? {}),
    ...(brandFilter ?? {}),
  };

  const [total, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Prisma Decimal doesn't JSON-serialize cleanly; normalize it.
  const normalized = items.map((p) => ({
    ...p,
    price: p.price ? p.price.toString() : null,
  }));

  return NextResponse.json({ items: normalized, total, page, pageSize });
}
