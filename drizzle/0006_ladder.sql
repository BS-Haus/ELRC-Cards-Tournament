ALTER TABLE "events" ADD COLUMN "format" text DEFAULT 'cards' NOT NULL;--> statement-breakpoint
ALTER TABLE "stages" ADD COLUMN "sitting" jsonb DEFAULT '[]'::jsonb NOT NULL;