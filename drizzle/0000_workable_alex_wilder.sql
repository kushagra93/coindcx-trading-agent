CREATE TABLE "agent_instances" (
	"agent_id" varchar(128) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"tier" varchar(16) NOT NULL,
	"broker_id" varchar(128),
	"running" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stopped_at" timestamp with time zone,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"sequence" bigserial NOT NULL,
	"timestamp" varchar(64) NOT NULL,
	"actor" varchar(128) NOT NULL,
	"actor_tier" varchar(16) NOT NULL,
	"action" varchar(128) NOT NULL,
	"resource" varchar(256) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error" text,
	"previous_hash" varchar(128) NOT NULL,
	"entry_hash" varchar(128) NOT NULL,
	"corr_id" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "builder_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" varchar(64) NOT NULL,
	"volume_usd" real NOT NULL,
	"fee_bps" real NOT NULL,
	"fee_usd" real NOT NULL,
	"builder_code" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circuit_breaker_losses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"amount" real NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circuit_breaker_trips" (
	"user_id" varchar(64) PRIMARY KEY NOT NULL,
	"tripped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "copy_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"lead_trader_id" varchar(64) NOT NULL,
	"budget_usd" real NOT NULL,
	"max_per_trade_pct" real NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_ledger" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"sequence" bigserial NOT NULL,
	"timestamp" varchar(64) NOT NULL,
	"type" varchar(32) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"agent_id" varchar(128) NOT NULL,
	"broker_id" varchar(128) NOT NULL,
	"trade_id" varchar(64) NOT NULL,
	"amount_usd" real NOT NULL,
	"amount_token" varchar(64) NOT NULL,
	"fee_token" varchar(128) NOT NULL,
	"chain" varchar(32) NOT NULL,
	"fee_rate" real NOT NULL,
	"corr_id" varchar(128) NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "fee_reservations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"trade_id" varchar(64) NOT NULL,
	"amount" varchar(64) NOT NULL,
	"token" varchar(128) NOT NULL,
	"chain" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "global_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_traders" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"wallet_addresses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pnl_30d" real DEFAULT 0 NOT NULL,
	"pnl_90d" real DEFAULT 0 NOT NULL,
	"win_rate" real DEFAULT 0 NOT NULL,
	"max_drawdown" real DEFAULT 0 NOT NULL,
	"sharpe_ratio" real DEFAULT 0 NOT NULL,
	"copiers_count" integer DEFAULT 0 NOT NULL,
	"aum_usd" real DEFAULT 0 NOT NULL,
	"track_record_days" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"chain" varchar(32) NOT NULL,
	"token" varchar(128) NOT NULL,
	"token_symbol" varchar(32) NOT NULL,
	"entry_price" real NOT NULL,
	"current_price" real NOT NULL,
	"amount" real NOT NULL,
	"cost_basis" real NOT NULL,
	"unrealized_pnl" real DEFAULT 0 NOT NULL,
	"unrealized_pnl_pct" real DEFAULT 0 NOT NULL,
	"high_water_mark" real NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"strategy_id" varchar(64) NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "risk_settings" (
	"user_id" varchar(64) PRIMARY KEY NOT NULL,
	"risk_level" varchar(16) DEFAULT 'moderate' NOT NULL,
	"daily_loss_limit_usd" real DEFAULT 1000 NOT NULL,
	"max_per_trade_pct" real DEFAULT 25 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"type" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"chain" varchar(32) NOT NULL,
	"tokens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget_usd" real NOT NULL,
	"risk_level" varchar(16) NOT NULL,
	"max_per_trade_pct" real NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"intent_id" varchar(64) NOT NULL,
	"state" varchar(32) NOT NULL,
	"chain" varchar(32) NOT NULL,
	"venue" varchar(32) NOT NULL,
	"side" varchar(8) NOT NULL,
	"input_token" varchar(128) NOT NULL,
	"output_token" varchar(128) NOT NULL,
	"amount_in" varchar(64) NOT NULL,
	"amount_out" varchar(64),
	"fee_amount" varchar(64),
	"fee_token" varchar(128),
	"tx_hash" varchar(128),
	"error" text,
	"idempotency_key" varchar(128) NOT NULL,
	"strategy_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" varchar(64) PRIMARY KEY NOT NULL,
	"total_pnl" real DEFAULT 0 NOT NULL,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"win_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_instances_user_id_idx" ON "agent_instances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_instances_running_idx" ON "agent_instances" USING btree ("running");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_corr_id_idx" ON "audit_log" USING btree ("corr_id");--> statement-breakpoint
CREATE INDEX "audit_log_sequence_idx" ON "audit_log" USING btree ("sequence");--> statement-breakpoint
CREATE INDEX "chat_messages_user_id_idx" ON "chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cb_losses_user_id_idx" ON "circuit_breaker_losses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cb_losses_recorded_at_idx" ON "circuit_breaker_losses" USING btree ("recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "copy_configs_user_leader_idx" ON "copy_configs" USING btree ("user_id","lead_trader_id");--> statement-breakpoint
CREATE INDEX "fee_ledger_user_id_idx" ON "fee_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fee_ledger_broker_id_idx" ON "fee_ledger" USING btree ("broker_id");--> statement-breakpoint
CREATE INDEX "fee_ledger_type_idx" ON "fee_ledger" USING btree ("type");--> statement-breakpoint
CREATE INDEX "fee_ledger_corr_id_idx" ON "fee_ledger" USING btree ("corr_id");--> statement-breakpoint
CREATE INDEX "fee_reservations_user_id_idx" ON "fee_reservations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fee_reservations_status_idx" ON "fee_reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fee_reservations_chain_token_idx" ON "fee_reservations" USING btree ("chain","token");--> statement-breakpoint
CREATE INDEX "positions_user_id_idx" ON "positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "positions_status_idx" ON "positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "positions_user_status_idx" ON "positions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "strategies_user_id_idx" ON "strategies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trades_user_id_idx" ON "trades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trades_state_idx" ON "trades" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "trades_idempotency_key_idx" ON "trades" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "trades_created_at_idx" ON "trades" USING btree ("created_at");