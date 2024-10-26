-- CreateTable
CREATE TABLE "MnemonicShare" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "share1" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MnemonicShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MnemonicShare_userId_key" ON "MnemonicShare"("userId");

-- AddForeignKey
ALTER TABLE "MnemonicShare" ADD CONSTRAINT "MnemonicShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
