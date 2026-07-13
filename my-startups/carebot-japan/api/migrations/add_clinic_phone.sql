-- Add phone column to clinics -- both POST /clinics/onboard and POST
-- /clinics/locations have always sent a "phone" field, but no such column
-- ever existed on clinics (only fax_number and sms_from), so both inserts
-- fail with "column clinics.phone does not exist" whenever a phone number
-- (or even a null placeholder) is submitted.
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS phone TEXT;
