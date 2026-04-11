-- Add Square receipt fields to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(255),
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;
