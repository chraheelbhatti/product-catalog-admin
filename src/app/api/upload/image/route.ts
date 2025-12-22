import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const productId = formData.get("productId") as string | null;

    if (!file || !productId) {
      return NextResponse.json({ error: "Missing file or product ID" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const ext = file.name.split(".").pop();
    const filename = `${productId}-${Date.now()}.${ext}`;
    
    // Save to public/uploads folder
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true }); // Ensure folder exists
    const path = join(uploadDir, filename);
    
    await writeFile(path, buffer);

    // Update Database
    const imageUrl = `/uploads/${filename}`;
    await prisma.product.update({
      where: { id: productId },
      data: { imageUrl },
    });

    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}