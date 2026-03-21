```sql
CREATE OR REPLACE FUNCTION create_booking_hold(
  p_site_id UUID,
  p_customer_id UUID,
  p_service_id UUID,
  p_staff_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE,
  p_end_time TIMESTAMP WITH TIME ZONE
)
RETURNS UUID AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  INSERT INTO bookings (site_id, customer_id, service_id, staff_id, start_time, end_time, status)
  VALUES (p_site_id, p_customer_id, p_service_id, p_staff_id, p_start_time, p_end_time, 'hold')
  RETURNING id INTO v_booking_id;
  
  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_booking_if_available(
  p_site_id UUID,
  p_customer_id UUID,
  p_service_id UUID,
  p_staff_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE,
  p_end_time TIMESTAMP WITH TIME ZONE
)
RETURNS UUID AS $$
DECLARE
  v_booking_id UUID;
  v_conflict_count INT;
BEGIN
  SELECT COUNT(*) INTO v_conflict_count
  FROM bookings
  WHERE site_id = p_site_id
    AND staff_id = p_staff_id
    AND status NOT IN ('cancelled')
    AND (
      (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
    );
  
  IF v_conflict_count = 0 THEN
    INSERT INTO bookings (site_id, customer_id, service_id, staff_id, start_time, end_time, status)
    VALUES (p_site_id, p_customer_id, p_service_id, p_staff_id, p_start_time, p_end_time, 'confirmed')
    RETURNING id INTO v_booking_id;
    
    RETURN v_booking_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_sms_inbox(p_site_id UUID)
RETURNS TABLE (
  id UUID,
  site_id UUID,
  phone_number TEXT,
  message_body TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  sender_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sms_inbox.id,
    sms_inbox.site_id,
    sms_inbox.phone_number,
    sms_inbox.message_body,
    sms_inbox.received_at,
    sms_inbox.sender_name
  FROM sms_inbox
  WHERE sms_inbox.site_id = p_site_id
  ORDER BY sms_inbox.received_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_customer_bookings(p_customer_id UUID)
RETURNS INT AS $$
DECLARE
  v_new_count INT;
BEGIN
  UPDATE customers
  SET booking_count = COALESCE(booking_count, 0) + 1
  WHERE id = p_customer_id
  RETURNING booking_count INTO v_new_count;
  
  RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```