-- Add reminder_sent column to bookings table
-- Tracks when the 24h reminder SMS was sent to prevent duplicates
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent timestamptz DEFAULT NULL;

-- Index for efficient cron query (find upcoming bookings without reminders)
CREATE INDEX IF NOT EXISTS idx_bookings_reminder ON bookings (booking_date, status, reminder_sent);
