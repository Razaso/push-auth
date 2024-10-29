/*
  Warnings:

  - Added the required column `publicKey` to the `MnemonicShareTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MnemonicShareTransaction" ADD COLUMN     "publicKey" TEXT NOT NULL;
