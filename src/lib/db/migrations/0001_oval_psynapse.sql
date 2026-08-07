ALTER TABLE "subtasks" ADD COLUMN "resources" text;--> statement-breakpoint
ALTER TABLE "subtasks" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "subtasks" ADD COLUMN "urgency" integer;--> statement-breakpoint
ALTER TABLE "subtasks" ADD COLUMN "importance" integer;--> statement-breakpoint
ALTER TABLE "subtasks" ADD COLUMN "keywords" text;--> statement-breakpoint
ALTER TABLE "subtasks" ADD COLUMN "bloom_level" integer;--> statement-breakpoint
ALTER TABLE "subtasks" ADD COLUMN "deep_work_hours" real;--> statement-breakpoint
ALTER TABLE "subtasks" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "raw_input" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "start_date" timestamp with time zone;