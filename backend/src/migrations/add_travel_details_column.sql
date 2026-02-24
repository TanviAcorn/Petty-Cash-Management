-- Migration: Add travel_details column to petty_cash_requests table
-- Purpose: Store flight and accommodation booking details for travel-related requests
-- Date: 2026-02-06

-- Check if the column already exists before adding it
IF NOT EXISTS (
  SELECT * 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'petty_cash_requests' 
  AND COLUMN_NAME = 'travel_details'
)
BEGIN
  ALTER TABLE petty_cash_requests
  ADD travel_details NVARCHAR(MAX) NULL;
  
  PRINT 'Successfully added travel_details column to petty_cash_requests table';
END
ELSE
BEGIN
  PRINT 'Column travel_details already exists in petty_cash_requests table';
END
GO
