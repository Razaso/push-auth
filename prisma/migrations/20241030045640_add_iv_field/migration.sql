-- First add the column as nullable
ALTER TABLE "MnemonicShareTransaction" ADD COLUMN "iv" TEXT;

-- Update existing records with a default value
UPDATE "MnemonicShareTransaction" SET "iv" = '' WHERE "iv" IS NULL;

-- Now make the column required
ALTER TABLE "MnemonicShareTransaction" ALTER COLUMN "iv" SET NOT NULL;