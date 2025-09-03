-- CreateTable
CREATE TABLE "public"."Receipt" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "nftId" INTEGER NOT NULL,
    "payer" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "metaURI" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_code_key" ON "public"."Receipt"("code");

-- CreateIndex
CREATE INDEX "Receipt_merchant_idx" ON "public"."Receipt"("merchant");

-- CreateIndex
CREATE INDEX "Receipt_payer_idx" ON "public"."Receipt"("payer");

-- CreateIndex
CREATE INDEX "Receipt_txHash_idx" ON "public"."Receipt"("txHash");
