-- CreateTable
CREATE TABLE "PartieVisibilityLock" (
    "id" TEXT NOT NULL,
    "partieId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "subField" TEXT,

    CONSTRAINT "PartieVisibilityLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartieVisibilityLock_partieId_fieldKey_subField_key" ON "PartieVisibilityLock"("partieId", "fieldKey", "subField");

-- AddForeignKey
ALTER TABLE "PartieVisibilityLock" ADD CONSTRAINT "PartieVisibilityLock_partieId_fkey" FOREIGN KEY ("partieId") REFERENCES "Partie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
