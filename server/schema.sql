-- MOSTAJIR — Neon PostgreSQL Schema
-- Run this once to initialize the database

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users (auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  wilaya_code INTEGER NOT NULL DEFAULT 16,
  wilaya_name TEXT NOT NULL DEFAULT 'الجزائر',
  verification_status TEXT NOT NULL DEFAULT 'none'
    CHECK (verification_status IN ('none','pending','verified','rejected')),
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active','banned','frozen')),
  wallet_balance NUMERIC NOT NULL DEFAULT 0,
  earnings_balance NUMERIC NOT NULL DEFAULT 0,
  frozen_balance NUMERIC NOT NULL DEFAULT 0,
  total_rentals INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  owner_rating NUMERIC DEFAULT 0,
  owner_review_count INTEGER DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  avatar_uri TEXT,
  kyc_rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KYC Requests
CREATE TABLE IF NOT EXISTS kyc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  id_front_uri TEXT NOT NULL,
  id_back_uri TEXT NOT NULL,
  selfie_uri TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  owner_avatar_uri TEXT,
  owner_phone TEXT,
  owner_address TEXT,
  owner_wilaya_code INTEGER,
  owner_wilaya_name TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  images TEXT[] NOT NULL DEFAULT '{}',
  video_uri TEXT,
  category_id TEXT NOT NULL,
  subcategory_id TEXT NOT NULL DEFAULT '',
  wilaya_code INTEGER NOT NULL,
  wilaya_name TEXT NOT NULL,
  purchase_price NUMERIC NOT NULL,
  purchase_year INTEGER NOT NULL DEFAULT 2020,
  rental_price NUMERIC NOT NULL,
  deposit NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 10,
  delivery_available BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','rented','unavailable')),
  stock_quantity INTEGER NOT NULL DEFAULT 1,
  available_quantity INTEGER NOT NULL DEFAULT 1,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  removal_reason TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  total_rentals INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Withdrawal Requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  ccp_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processed','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rentals
CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  product_title TEXT NOT NULL,
  product_image TEXT,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  owner_name TEXT NOT NULL,
  renter_id UUID NOT NULL REFERENCES profiles(id),
  renter_name TEXT NOT NULL,
  renter_phone TEXT NOT NULL,
  renter_address TEXT NOT NULL DEFAULT '',
  renter_wilaya TEXT NOT NULL DEFAULT '',
  self_pickup BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_days INTEGER NOT NULL DEFAULT 1,
  daily_rate NUMERIC NOT NULL,
  deposit NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  net_earnings NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  escrow_amount NUMERIC NOT NULL DEFAULT 0,
  late_penalty NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_owner',
  qr_code_delivery TEXT NOT NULL DEFAULT '',
  qr_code_return TEXT NOT NULL DEFAULT '',
  handover_token TEXT,
  return_token TEXT,
  extension_requested BOOLEAN NOT NULL DEFAULT false,
  extension_days INTEGER,
  alert_48h_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rentals_handover_token ON rentals(handover_token);
CREATE INDEX IF NOT EXISTS idx_rentals_return_token ON rentals(return_token);

-- Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES rentals(id),
  product_title TEXT NOT NULL DEFAULT '',
  filed_by TEXT NOT NULL CHECK (filed_by IN ('owner','renter')),
  user_id UUID NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  other_party_id UUID REFERENCES users(id),
  other_party_name TEXT,
  other_party_phone TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','under_review','resolved','rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Top-up Transactions
CREATE TABLE IF NOT EXISTS top_up_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'chargily',
  checkout_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_rental_id_idx ON messages(rental_id, created_at);
CREATE INDEX IF NOT EXISTS messages_receiver_idx ON messages(receiver_id) WHERE read = false;

-- Owner Ratings
CREATE TABLE IF NOT EXISTS owner_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rental_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rental_id, renter_id)
);

-- Admin Settings (single row)
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: update owner rating average after new rating
CREATE OR REPLACE FUNCTION update_owner_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  avg_rating NUMERIC;
  total_count INTEGER;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(*)
  INTO avg_rating, total_count
  FROM owner_ratings
  WHERE owner_id = NEW.owner_id;
  UPDATE profiles SET owner_rating = avg_rating, owner_review_count = total_count
  WHERE id = NEW.owner_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_owner_rating ON owner_ratings;
CREATE TRIGGER trg_update_owner_rating
AFTER INSERT ON owner_ratings
FOR EACH ROW EXECUTE FUNCTION update_owner_rating();
