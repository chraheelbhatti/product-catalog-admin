-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "itemName" TEXT,
ADD COLUMN     "minQty" INTEGER,
ADD COLUMN     "supplierName" TEXT;

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");
