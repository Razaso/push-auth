/*
  Warnings:

  - Added the required column `status` to the `AuthToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuthToken" ADD COLUMN     "status" TEXT NOT NULL;
