-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creatorName" TEXT,
    "creatorId" TEXT,
    "itemUrl" TEXT NOT NULL,
    "rolimonsUrl" TEXT,
    "thumbnailUrl" TEXT,
    "price" INTEGER,
    "discoveredAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "notificationError" TEXT,
    "notificationClaimId" TEXT,
    "notificationClaimExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerState" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "lastScanAt" TIMESTAMP(3),
    "nextScanAt" TIMESTAMP(3),
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsNotified" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lockId" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_assetId_key" ON "Item"("assetId");

-- CreateIndex
CREATE INDEX "Item_discoveredAt_idx" ON "Item"("discoveredAt");

-- CreateIndex
CREATE INDEX "Item_notifiedAt_idx" ON "Item"("notifiedAt");
