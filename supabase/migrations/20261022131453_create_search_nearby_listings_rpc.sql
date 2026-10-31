CREATE FUNCTION public.search_nearby_listings(
    p_latitude double precision,
    p_longitude double precision,
    p_radius_km integer DEFAULT 3,
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    listing_id uuid,
    property_id uuid,
    title text,
    asking_rent_monthly numeric,
    property_type text,
    city text,
    barangay text,
    available_from date,
    public_latitude double precision,
    public_longitude double precision,
    distance_meters numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_tenant_location extensions.geography;
BEGIN
    IF p_latitude IS NULL
       OR p_latitude NOT BETWEEN -90 AND 90
       OR p_longitude IS NULL
       OR p_longitude NOT BETWEEN -180 AND 180
    THEN
        RAISE EXCEPTION 'Invalid GPS coordinates'
            USING ERRCODE = '22023';
    END IF;

    IF p_radius_km IS NULL
       OR p_radius_km NOT IN (1, 3, 5)
    THEN
        RAISE EXCEPTION 'Radius must be 1, 3, or 5 km'
            USING ERRCODE = '22023';
    END IF;

    IF p_limit IS NULL
       OR p_limit NOT BETWEEN 1 AND 50
       OR p_offset IS NULL
       OR p_offset NOT BETWEEN 0 AND 1000
    THEN
        RAISE EXCEPTION 'Invalid pagination parameters'
            USING ERRCODE = '22023';
    END IF;

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '28000';
    END IF;

    IF NOT public.has_app_role(
        'tenant'::public.app_role, auth.uid()
    )
    OR NOT public.is_tier1_verified(auth.uid())
    THEN
        RAISE EXCEPTION 'Tenant verification required'
            USING ERRCODE = '42501';
    END IF;

    v_tenant_location :=
        extensions.ST_SetSRID(
            extensions.ST_MakePoint(
                p_longitude,
                p_latitude
            ),
            4326
        )::extensions.geography;

    RETURN QUERY
    SELECT
        l.id,
        p.id,
        l.title,
        l.asking_rent_monthly,
        p.property_type::text,
        p.city::text,
        p.barangay,
        l.available_from,
        extensions.ST_Y(
            p.public_location::extensions.geometry
        ),
        extensions.ST_X(
            p.public_location::extensions.geometry
        ),
        ROUND(
            extensions.ST_Distance(
                p.public_location,
                v_tenant_location
            )::numeric, 2
        )
    FROM public.listings l
    JOIN public.properties p
        ON p.id = l.property_id
    WHERE l.status = 'active'::public.listing_status
      AND p.is_active IS TRUE
      AND (
          l.available_from IS NULL
          OR l.available_from <=
              (now() AT TIME ZONE 'Asia/Manila')::date
      )
      AND extensions.ST_DWithin(
          p.public_location,
          v_tenant_location,
          p_radius_km * 1000.0
      )
    ORDER BY
        extensions.ST_Distance(
            p.public_location,
            v_tenant_location
        ),
        l.id
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.search_nearby_listings(
    double precision, double precision,
    integer, integer, integer
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.search_nearby_listings(
    double precision, double precision,
    integer, integer, integer
) TO authenticated;;
