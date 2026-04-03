-- ============================================================
-- Missing GCR tables migration
-- Run in Supabase SQL Editor on the GCR database
-- ============================================================

-- Business embeddings (for RAG/AI search)
CREATE TABLE IF NOT EXISTS public.business_embeddings (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   uuid REFERENCES public.entity(id) ON DELETE CASCADE,
    slug        text,
    content     text,
    embedding   vector(1536),
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_embeddings_entity_id_idx ON public.business_embeddings(entity_id);

-- GCR Reviews
CREATE TABLE IF NOT EXISTS public.gcr_reviews (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   uuid REFERENCES public.entity(id) ON DELETE CASCADE,
    reviewer_name text,
    rating      numeric(2,1),
    review_text text,
    status      text DEFAULT 'pending',
    source      text DEFAULT 'manual',
    created_at  timestamptz DEFAULT now()
);

-- GCR Customers
CREATE TABLE IF NOT EXISTS public.gcr_customers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   uuid REFERENCES public.entity(id) ON DELETE SET NULL,
    name        text,
    email       text,
    phone       text,
    customer_type text DEFAULT 'customer',
    notes       text,
    created_at  timestamptz DEFAULT now()
);

-- GCR Coupons
CREATE TABLE IF NOT EXISTS public.gcr_coupons (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   uuid REFERENCES public.entity(id) ON DELETE CASCADE,
    code        text,
    description text,
    discount_type text DEFAULT 'percent',
    discount_value numeric,
    valid_from  date,
    valid_to    date,
    is_active   boolean DEFAULT true,
    created_at  timestamptz DEFAULT now()
);

-- GCR SEO Settings
CREATE TABLE IF NOT EXISTS public.gcr_seo_settings (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   uuid UNIQUE REFERENCES public.entity(id) ON DELETE CASCADE,
    meta_title  text,
    meta_description text,
    keywords    text,
    og_image    text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- GCR Messaging Settings
CREATE TABLE IF NOT EXISTS public.gcr_messaging_settings (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   uuid UNIQUE REFERENCES public.entity(id) ON DELETE CASCADE,
    owner_phone text,
    notif_email text,
    booking_template text,
    review_template  text,
    notify_booking   boolean DEFAULT true,
    notify_review    boolean DEFAULT true,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);
