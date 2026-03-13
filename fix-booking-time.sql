-- Fix: booking_time column should be TEXT not TIME
-- The app stores display strings like "10:00 AM" or "Morning Session"
ALTER TABLE bookings ALTER COLUMN booking_time TYPE TEXT;
