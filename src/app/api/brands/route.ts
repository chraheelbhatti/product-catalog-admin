import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.product.findMany({
    where: {
      brand: {
        not: null,
      },
    },
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
  });

  const brands = rows
    .map((r) => r.brand)
    .filter((b): b is string => Boolean(b));

  return NextResponse.json({ brands });
}