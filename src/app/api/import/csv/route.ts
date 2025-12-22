import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseCSVLine(line: string): string[] {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result.map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"'));
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) return NextResponse.json({ error: "Empty CSV" }, { status: 400 });

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    
    // --- UPDATED MAPPING BASED ON YOUR REQUEST ---
    const idx = {
      // Prioritize "remark" for Name, "brandname" for Brand, "mrp" for Price
      sku: headers.indexOf("skucode"), 
      name: headers.indexOf("remark"), 
      brand: headers.indexOf("brandname"),
      price: headers.indexOf("mrp"), 
      
      // Fallbacks if your CSV changes later
      category: headers.indexOf("category"),
      stock: headers.indexOf("stockqty"),
      minQty: headers.indexOf("minqty"),
      imageUrl: headers.indexOf("imagepath")
    };

    if (idx.sku === -1 || idx.name === -1) {
      return NextResponse.json({ error: "CSV must have 'SKUCode' and 'Remark' columns." }, { status: 400 });
    }

    const operations = lines.slice(1).map(line => {
      const cols = parseCSVLine(line);
      if (cols.length < 2) return null;

      const sku = cols[idx.sku];
      const name = cols[idx.name]; // This comes from "Remark"
      if (!sku || !name) return null;

      const brand = idx.brand > -1 ? cols[idx.brand] || null : null;
      
      // Clean price (remove commas/currency symbols before saving)
      const priceRaw = idx.price > -1 ? cols[idx.price] : null;
      const price = priceRaw ? priceRaw.replace(/[^0-9.]/g, "") : null;
      
      const stock = idx.stock > -1 && cols[idx.stock] ? parseInt(cols[idx.stock]) : undefined;
      const minQty = idx.minQty > -1 && cols[idx.minQty] ? parseInt(cols[idx.minQty]) : undefined;
      const imageUrl = idx.imageUrl > -1 ? cols[idx.imageUrl] : undefined;
      const category = idx.category > -1 ? cols[idx.category] : undefined;

      return prisma.product.upsert({
        where: { sku },
        create: { sku, name, brand, category, imageUrl, stock, minQty, price },
        update: { name, brand, category, imageUrl, stock, minQty, price }
      });
    }).filter(Boolean);

    await prisma.$transaction(operations as any);
    return NextResponse.json({ success: true, message: `Processed ${operations.length} items.` });
  } catch (error) {
    console.error("Import Error:", error);
    return NextResponse.json({ error: "Failed to process CSV file." }, { status: 500 });
  }
}