CREATE OR REPLACE FUNCTION public.review_verification_submission(
  requested_submission_id uuid,
  requested_status public.verification_status,
  requested_review_note text DEFAULT NULL,
  requested_rejection_reason text DEFAULT NULL
)
RETURNS public.verification_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid;
  submission public.verification_submissions%ROWTYPE;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING errcode = '42501';
  END IF;

  SELECT * INTO submission FROM public.verification_submissions
  WHERE id = requested_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification submission not found' USING errcode = 'P0002';
  END IF;

  IF submission.status = 'pending' AND requested_status <> 'under_review' THEN
    RAISE EXCEPTION 'Pending submissions must first move to under_review' USING errcode = '22023';
  END IF;
  IF submission.status = 'under_review' AND requested_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Under-review submissions may only be approved or rejected' USING errcode = '22023';
  END IF;
  IF submission.status NOT IN ('pending', 'under_review') THEN
    RAISE EXCEPTION 'This submission can no longer be reviewed through this workflow' USING errcode = '22023';
  END IF;

  IF requested_status = 'approved' THEN
    IF submission.tier = 'tier_3_property' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.verification_documents d
        WHERE d.submission_id = requested_submission_id
          AND d.document_type IN (
            'land_title'::public.verification_document_type,
            'tax_declaration'::public.verification_document_type,
            'hoa_document'::public.verification_document_type,
            'authorization_to_lease'::public.verification_document_type
          )
      ) THEN
        RAISE EXCEPTION 'Tier 3 approval requires a qualifying property ownership or authorization document'
          USING errcode = '22023';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.verification_documents d
      WHERE d.submission_id = requested_submission_id
    ) THEN
      RAISE EXCEPTION 'Cannot approve a verification submission without a document'
        USING errcode = '22023';
    END IF;
  END IF;

  IF requested_status = 'rejected'
     AND nullif(trim(requested_rejection_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required' USING errcode = '22023';
  END IF;

  UPDATE public.verification_submissions
  SET status = requested_status,
      reviewed_by = caller_id,
      review_note = requested_review_note,
      rejection_reason = CASE WHEN requested_status = 'rejected'
                              THEN requested_rejection_reason ELSE NULL END,
      reviewed_at = CASE WHEN requested_status IN ('approved', 'rejected')
                         THEN now() ELSE NULL END
  WHERE id = requested_submission_id
  RETURNING * INTO submission;
  RETURN submission;
END;
$function$;;
