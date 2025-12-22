import { NextResponse } from "next/server";
import path from "path";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";

// Standalone PDFKit to bypass Next.js/Webpack environment shimming
const PDFDocument = require("pdfkit/js/pdfkit.standalone");

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, orderNumber, customerName } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items to export" }, { status: 400 });
    }

    // --- 1. BRANDING & METADATA ---
    const orderRef = orderNumber ? `ZeeReOrder-${orderNumber}` : "ZeeReOrder-TEMP";
    const timestamp = new Date().toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true 
    });

    // --- 2. ASYNC IMAGE HANDLING (Base64) ---
    const itemsWithImages = await Promise.all(
      items.map(async (item: any) => {
        let base64 = null;
        if (item.imageUrl) {
          try {
            const cleanUrl = decodeURIComponent(item.imageUrl).replace(/^\/|\\/, "");
            const fullPath = path.join(process.cwd(), "public", cleanUrl);
            await access(fullPath, constants.R_OK);
            const buffer = await readFile(fullPath);
            base64 = `data:image/png;base64,${buffer.toString("base64")}`;
          } catch (e) {
            console.error(`Media unavailable: ${item.imageUrl}`);
          }
        }
        return { ...item, base64 };
      })
    );

    // --- 3. PAGE CALCULATIONS (Set to 12 per page) ---
    const itemsPerPage = 12; 
    const totalPages = Math.ceil(itemsWithImages.length / itemsPerPage);

    const doc = new PDFDocument({ margin: 30, size: "A4" });
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: any) => chunks.push(chunk));

    const drawHeader = (pageNum: number) => {
      // Condensed Header Accent
      doc.rect(0, 0, 595, 80).fill("#f8fafc");
      
      // Branding
      doc.fillColor("#0f172a").fontSize(20).font("Helvetica-Bold").text("Zee Ordering", 40, 25);
      doc.fontSize(7).font("Helvetica").fillColor("#64748b").text("PREMIUM CATALOG MANAGEMENT SYSTEM", 40, 48);

      const rightX = 385;
      doc.fillColor("#0f172a").fontSize(8).font("Helvetica-Bold").text("ORDER REFERENCE", rightX, 25);
      doc.font("Helvetica").fillColor("#334155").text(orderRef, rightX, 35);
      
      doc.font("Helvetica-Bold").fillColor("#0f172a").text("GENERATED ON", rightX, 50);
      doc.font("Helvetica").fillColor("#334155").text(timestamp, rightX, 60);

      if (customerName) {
        doc.font("Helvetica-Bold").fillColor("#0f172a").text("CLIENT:", 40, 62);
        doc.font("Helvetica").fillColor("#334155").text(customerName.toUpperCase(), 75, 62);
      }

      doc.fontSize(7).fillColor("#94a3b8").text(`PAGE ${pageNum} OF ${totalPages}`, 480, 62, { width: 75, align: "right" });
    };

    const drawTableHead = (y: number) => {
      doc.rect(40, y, 515, 20).fill("#1e293b");
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
      
      const ty = y + 6;
      doc.text("S.NO", 45, ty);
      doc.text("IMAGE", 85, ty);
      doc.text("PRODUCT DETAILS", 140, ty);
      doc.text("UNIT PRICE", 340, ty, { width: 70, align: "right" });
      doc.text("QTY", 420, ty, { width: 40, align: "center" });
      doc.text("SUBTOTAL", 480, ty, { width: 70, align: "right" });
    };

    // --- 4. RENDER ENGINE ---
    let currentPageNum = 1;
    drawHeader(currentPageNum);
    
    // Table starts at y=90 to maximize Page 1 vertical space
    let yPos = 90; 
    drawTableHead(yPos);
    yPos += 20;

    let grandTotal = 0;

    itemsWithImages.forEach((item, i) => {
      if (i > 0 && i % itemsPerPage === 0) {
        doc.addPage();
        currentPageNum++;
        drawHeader(currentPageNum);
        yPos = 90;
        drawTableHead(yPos);
        yPos += 20;
      }

      const rowSubtotal = (item.unitPrice || 0) * (item.qty || 0);
      grandTotal += rowSubtotal;

      if (i % 2 !== 0) {
        doc.rect(40, yPos, 515, 52).fill("#f8fafc");
      }

      doc.fillColor("#475569").fontSize(8).font("Helvetica").text(String(i + 1), 45, yPos + 22);

      if (item.base64) {
        try {
          doc.image(item.base64, 75, yPos + 6, { fit: [40, 40], align: 'center', valign: 'center' });
        } catch (err) {
          doc.fontSize(5).text("IMG ERR", 75, yPos + 22);
        }
      } else {
        doc.rect(75, yPos + 6, 40, 40).lineWidth(0.2).stroke("#cbd5e1");
        doc.fontSize(6).fillColor("#94a3b8").text("NO IMAGE", 75, yPos + 24, { width: 40, align: "center" });
      }

      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9).text(item.name, 140, yPos + 10, { width: 190, ellipsis: true });
      doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(item.sku || "N/A", 140, yPos + 24);
      if (item.brand) {
        doc.fontSize(7).fillColor("#475569").text(`Brand: ${item.brand}`, 140, yPos + 34);
      }

      doc.fillColor("#0f172a").font("Helvetica").fontSize(9).text(item.unitPrice.toFixed(2), 340, yPos + 22, { width: 70, align: "right" });
      doc.font("Helvetica-Bold").text(`x${item.qty}`, 420, yPos + 22, { width: 40, align: "center" });
      doc.text(rowSubtotal.toFixed(2), 480, yPos + 22, { width: 70, align: "right" });

      doc.moveTo(40, yPos + 52).lineTo(555, yPos + 52).lineWidth(0.1).stroke("#e2e8f0");
      yPos += 52;
    });

    // --- 5. SUMMARY SECTION ---
    if (yPos > 730) { 
        doc.addPage(); 
        currentPageNum++;
        drawHeader(currentPageNum); 
        yPos = 90; 
    }
    
    yPos += 20;
    const summaryX = 395;
    doc.rect(summaryX, yPos, 160, 45).fill("#1e293b");
    doc.fillColor("#94a3b8").fontSize(7).font("Helvetica").text("GRAND TOTAL (INR)", summaryX + 12, yPos + 10);
    doc.fillColor("#ffffff").fontSize(13).font("Helvetica-Bold").text(`₹ ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + 12, yPos + 22, { width: 135, align: "right" });

    doc.end();

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const _chunks: any[] = [];
      doc.on("data", (chunk: any) => _chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(_chunks)));
      doc.on("error", reject);
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${orderRef}.pdf"`,
      },
    });

  } catch (error) {
    console.error("PDF Export Failure:", error);
    return new NextResponse(JSON.stringify({ error: "Server Error" }), { status: 500 });
  }
}