/**
 * Database setup script for MOSTAJIR on Neon PostgreSQL
 * Run: node server/scripts/setup-db.js
 */
const { Pool } = require('pg');

const connectionString = process.env.NEON_DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: NEON_DB_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

const schema = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users table (custom auth, replaces Supabase auth.users) ──
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Profiles ──
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  wilaya_code integer NOT NULL DEFAULT 16,
  wilaya_name text NOT NULL DEFAULT 'الجزائر',
  verification_status text NOT NULL DEFAULT 'none'
    CHECK (verification_status IN ('none','pending','verified','rejected')),
  account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active','banned','frozen')),
  wallet_balance numeric NOT NULL DEFAULT 0,
  earnings_balance numeric NOT NULL DEFAULT 0,
  frozen_balance numeric NOT NULL DEFAULT 0,
  total_rentals integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  owner_rating numeric NOT NULL DEFAULT 0,
  owner_review_count integer NOT NULL DEFAULT 0,
  is_admin boolean NOT NULL DEFAULT false,
  avatar_uri text,
  kyc_rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── KYC Requests ──
CREATE TABLE IF NOT EXISTS kyc_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  user_phone text NOT NULL DEFAULT '',
  id_front_uri text NOT NULL,
  id_back_uri text NOT NULL,
  selfie_uri text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

-- ── Products ──
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_name text NOT NULL DEFAULT '',
  owner_avatar_uri text,
  owner_phone text,
  owner_address text,
  owner_wilaya_code integer,
  owner_wilaya_name text,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  video_uri text,
  category_id text NOT NULL,
  subcategory_id text NOT NULL DEFAULT '',
  wilaya_code integer NOT NULL DEFAULT 16,
  wilaya_name text NOT NULL DEFAULT '',
  purchase_price numeric NOT NULL DEFAULT 0,
  purchase_year integer NOT NULL DEFAULT 2020,
  rental_price numeric NOT NULL DEFAULT 0,
  deposit numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 10,
  delivery_available boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','rented')),
  stock_quantity integer NOT NULL DEFAULT 1,
  available_quantity integer NOT NULL DEFAULT 1,
  is_hidden boolean NOT NULL DEFAULT false,
  is_frozen boolean NOT NULL DEFAULT false,
  removal_reason text,
  review_status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  owner_rating numeric NOT NULL DEFAULT 0,
  owner_review_count integer NOT NULL DEFAULT 0,
  owner_total_rentals integer NOT NULL DEFAULT 0,
  total_rentals integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Withdrawal Requests ──
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  ccp_number text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Rentals ──
CREATE TABLE IF NOT EXISTS rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_title text NOT NULL DEFAULT '',
  product_image text,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  owner_name text NOT NULL DEFAULT '',
  renter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  renter_name text NOT NULL DEFAULT '',
  renter_phone text NOT NULL DEFAULT '',
  renter_address text NOT NULL DEFAULT '',
  renter_wilaya text NOT NULL DEFAULT '',
  self_pickup boolean NOT NULL DEFAULT false,
  start_time timestamptz,
  end_time timestamptz,
  duration_days integer NOT NULL DEFAULT 1,
  daily_rate numeric NOT NULL DEFAULT 0,
  deposit numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  net_earnings numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  escrow_amount numeric NOT NULL DEFAULT 0,
  late_penalty numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_owner'
    CHECK (status IN ('pending_owner','accepted','pending_delivery','active','completed','cancelled','extend_requested')),
  qr_code_delivery text NOT NULL DEFAULT '',
  qr_code_return text NOT NULL DEFAULT '',
  handover_token text,
  return_token text,
  extension_requested boolean NOT NULL DEFAULT false,
  extension_days integer,
  alert_48h_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rentals_handover_token ON rentals(handover_token);
CREATE INDEX IF NOT EXISTS idx_rentals_return_token ON rentals(return_token);
CREATE INDEX IF NOT EXISTS idx_rentals_owner_id ON rentals(owner_id);
CREATE INDEX IF NOT EXISTS idx_rentals_renter_id ON rentals(renter_id);
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON products(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- ── Disputes ──
CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid REFERENCES rentals(id) ON DELETE SET NULL,
  product_title text NOT NULL DEFAULT '',
  filed_by text NOT NULL CHECK (filed_by IN ('owner','renter')),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_name text NOT NULL DEFAULT '',
  user_phone text NOT NULL DEFAULT '',
  other_party_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  other_party_name text,
  other_party_phone text,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved','rejected')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- ── Notifications ──
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'general',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, read);

-- ── Top-up Transactions ──
CREATE TABLE IF NOT EXISTS top_up_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'chargily',
  checkout_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- ── Owner Ratings ──
CREATE TABLE IF NOT EXISTS owner_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  renter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rental_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (rental_id, renter_id)
);

-- ── Messages ──
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_rental_id_idx ON messages(rental_id, created_at);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages(receiver_id) WHERE read = false;

-- ── Admin Settings ──
CREATE TABLE IF NOT EXISTS admin_settings (
  id integer PRIMARY KEY DEFAULT 1,
  settings jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Auto-update owner rating trigger ──
CREATE OR REPLACE FUNCTION update_owner_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  avg_rating numeric;
  total_count integer;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(*)
  INTO avg_rating, total_count
  FROM owner_ratings
  WHERE owner_id = NEW.owner_id;
  UPDATE profiles
  SET owner_rating = avg_rating, owner_review_count = total_count
  WHERE id = NEW.owner_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_owner_rating ON owner_ratings;
CREATE TRIGGER trg_update_owner_rating
  AFTER INSERT ON owner_ratings
  FOR EACH ROW EXECUTE FUNCTION update_owner_rating();
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('Running schema migration...');
    await client.query(schema);
    console.log('Schema created/updated successfully.');

    // Create admin user
    const bcrypt = require('bcrypt');
    const adminEmail = 'admin@mostajir.dz';
    const adminPassword = 'Admin@Mostajir2024!';
    const hash = await bcrypt.hash(adminPassword, 10);

    const { rows: [existing] } = await client.query(
      `SELECT id FROM users WHERE email=$1`, [adminEmail]
    );

    if (!existing) {
      const { rows: [newUser] } = await client.query(
        `INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id`,
        [adminEmail, hash]
      );
      await client.query(
        `INSERT INTO profiles (id, name, is_admin, verification_status)
         VALUES ($1,'Admin MOSTAJIR',true,'verified')`,
        [newUser.id]
      );
      console.log('Admin account created:');
      console.log('  Email:', adminEmail);
      console.log('  Password:', adminPassword);
    } else {
      await client.query(`UPDATE profiles SET is_admin=true WHERE id=$1`, [existing.id]);
      console.log('Admin account already exists, ensured is_admin=true');
    }

    console.log('Done!');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
