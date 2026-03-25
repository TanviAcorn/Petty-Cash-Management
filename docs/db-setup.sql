-- ============================================================
-- Petty Cash Management — Full DB Setup Script
-- Run this in SQL Server Management Studio (SSMS)
-- All statements are safe to re-run (existence checks included)
-- ============================================================


-- ============================================================
-- 1. NEW TABLE: travel_documents
--    Stores files uploaded by admin per travel request
-- ============================================================
IF OBJECT_ID('dbo.travel_documents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.travel_documents (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    request_id    INT           NOT NULL,
    filename      NVARCHAR(500) NOT NULL,
    original_name NVARCHAR(500) NOT NULL,
    mimetype      NVARCHAR(200) NULL,
    uploaded_by   NVARCHAR(320) NULL,
    uploaded_at   DATETIME2     DEFAULT SYSUTCDATETIME(),
    doc_type      NVARCHAR(100) NULL   -- 'flights','hotel','visa','carPark','food','baggage','general'
  );
  PRINT 'Created table: travel_documents';
END
ELSE
  PRINT 'Table already exists: travel_documents';


-- ============================================================
-- 2. NEW TABLE: travel_feedback
--    Stores post-trip feedback submitted by employees
-- ============================================================
IF OBJECT_ID('dbo.travel_feedback', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.travel_feedback (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    request_id       INT           NOT NULL,
    token            NVARCHAR(64)  NOT NULL UNIQUE,
    employee_email   NVARCHAR(320) NOT NULL,
    sent_at          DATETIME2     NULL,
    submitted_at     DATETIME2     NULL,
    -- Ratings (1–5)
    hotel_rating     INT           NULL,
    food_rating      INT           NULL,
    vehicle_rating   INT           NULL,
    car_park_rating  INT           NULL,
    flights_rating   INT           NULL,
    overall_rating   INT           NULL,
    -- Free-text remarks
    remarks          NVARCHAR(MAX) NULL,
    hotel_remarks    NVARCHAR(MAX) NULL,
    food_remarks     NVARCHAR(MAX) NULL,
    vehicle_remarks  NVARCHAR(MAX) NULL,
    car_park_remarks NVARCHAR(MAX) NULL,
    flights_remarks  NVARCHAR(MAX) NULL
  );
  PRINT 'Created table: travel_feedback';
END
ELSE
  PRINT 'Table already exists: travel_feedback';


-- ============================================================
-- 3. ALTER TABLE: petty_Users
--    Add passport / nationality fields
-- ============================================================
IF COL_LENGTH('dbo.petty_Users', 'passport_number') IS NULL
BEGIN
  ALTER TABLE dbo.petty_Users ADD passport_number NVARCHAR(50) NULL;
  PRINT 'Added column: petty_Users.passport_number';
END

IF COL_LENGTH('dbo.petty_Users', 'nationality') IS NULL
BEGIN
  ALTER TABLE dbo.petty_Users ADD nationality NVARCHAR(100) NULL;
  PRINT 'Added column: petty_Users.nationality';
END

IF COL_LENGTH('dbo.petty_Users', 'passport_expiry') IS NULL
BEGIN
  ALTER TABLE dbo.petty_Users ADD passport_expiry DATE NULL;
  PRINT 'Added column: petty_Users.passport_expiry';
END

IF COL_LENGTH('dbo.petty_Users', 'passport_name') IS NULL
BEGIN
  ALTER TABLE dbo.petty_Users ADD passport_name NVARCHAR(200) NULL;
  PRINT 'Added column: petty_Users.passport_name';
END

IF COL_LENGTH('dbo.petty_Users', 'passport_issue_date') IS NULL
BEGIN
  ALTER TABLE dbo.petty_Users ADD passport_issue_date DATE NULL;
  PRINT 'Added column: petty_Users.passport_issue_date';
END

IF COL_LENGTH('dbo.petty_Users', 'l1_manager_id') IS NULL
BEGIN
  ALTER TABLE dbo.petty_Users ADD l1_manager_id INT NULL;
  PRINT 'Added column: petty_Users.l1_manager_id';
END


-- ============================================================
-- 4. ALTER TABLE: petty_cash_requests
--    Add travel approval + admin document fields
-- ============================================================

-- L1 approval tracking
IF COL_LENGTH('dbo.petty_cash_requests', 'l1_approval_status') IS NULL
BEGIN
  ALTER TABLE dbo.petty_cash_requests ADD l1_approval_status NVARCHAR(50) NULL;
  PRINT 'Added column: petty_cash_requests.l1_approval_status';
END

IF COL_LENGTH('dbo.petty_cash_requests', 'l1_approved_at') IS NULL
BEGIN
  ALTER TABLE dbo.petty_cash_requests ADD l1_approved_at DATETIME2 NULL;
  PRINT 'Added column: petty_cash_requests.l1_approved_at';
END

IF COL_LENGTH('dbo.petty_cash_requests', 'l1_rejection_reason') IS NULL
BEGIN
  ALTER TABLE dbo.petty_cash_requests ADD l1_rejection_reason NVARCHAR(MAX) NULL;
  PRINT 'Added column: petty_cash_requests.l1_rejection_reason';
END

IF COL_LENGTH('dbo.petty_cash_requests', 'l1_manager_id') IS NULL
BEGIN
  ALTER TABLE dbo.petty_cash_requests ADD l1_manager_id INT NULL;
  PRINT 'Added column: petty_cash_requests.l1_manager_id';
END

-- Travel form data (JSON blob from frontend form)
IF COL_LENGTH('dbo.petty_cash_requests', 'travel_form_data') IS NULL
BEGIN
  ALTER TABLE dbo.petty_cash_requests ADD travel_form_data NVARCHAR(MAX) NULL;
  PRINT 'Added column: petty_cash_requests.travel_form_data';
END

-- Admin-filled travel details (JSON: flights, hotel, visa, etc.)
IF COL_LENGTH('dbo.petty_cash_requests', 'travel_admin_details') IS NULL
BEGIN
  ALTER TABLE dbo.petty_cash_requests ADD travel_admin_details NVARCHAR(MAX) NULL;
  PRINT 'Added column: petty_cash_requests.travel_admin_details';
END

-- Admin free-text remarks sent to employee
IF COL_LENGTH('dbo.petty_cash_requests', 'travel_admin_remarks') IS NULL
BEGIN
  ALTER TABLE dbo.petty_cash_requests ADD travel_admin_remarks NVARCHAR(MAX) NULL;
  PRINT 'Added column: petty_cash_requests.travel_admin_remarks';
END

-- Timestamp when travel docs were emailed to employee
IF COL_LENGTH('dbo.petty_cash_requests', 'travel_docs_sent_at') IS NULL
BEGIN
  ALTER TABLE dbo.petty_cash_requests ADD travel_docs_sent_at DATETIME2 NULL;
  PRINT 'Added column: petty_cash_requests.travel_docs_sent_at';
END


-- ============================================================
-- Done
-- ============================================================
PRINT '================================================';
PRINT 'DB setup complete. All tables and columns ready.';
PRINT '================================================';
