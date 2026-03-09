-- Add L1 Manager field to users table
IF COL_LENGTH('dbo.petty_Users', 'l1_manager_id') IS NULL
BEGIN
    ALTER TABLE dbo.petty_Users ADD l1_manager_id INT NULL;
    ALTER TABLE dbo.petty_Users ADD CONSTRAINT FK_Users_L1Manager 
        FOREIGN KEY (l1_manager_id) REFERENCES petty_Users(id);
END;

-- Add travel request fields to requests table
IF COL_LENGTH('dbo.petty_cash_requests', 'is_travel_request') IS NULL
BEGIN
    ALTER TABLE dbo.petty_cash_requests ADD is_travel_request BIT DEFAULT 0;
END;

IF COL_LENGTH('dbo.petty_cash_requests', 'travel_form_data') IS NULL
BEGIN
    ALTER TABLE dbo.petty_cash_requests ADD travel_form_data NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.petty_cash_requests', 'l1_manager_id') IS NULL
BEGIN
    ALTER TABLE dbo.petty_cash_requests ADD l1_manager_id INT NULL;
END;

IF COL_LENGTH('dbo.petty_cash_requests', 'l1_approved_at') IS NULL
BEGIN
    ALTER TABLE dbo.petty_cash_requests ADD l1_approved_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.petty_cash_requests', 'l1_approval_status') IS NULL
BEGIN
    ALTER TABLE dbo.petty_cash_requests ADD l1_approval_status VARCHAR(20) DEFAULT 'pending';
END;

IF COL_LENGTH('dbo.petty_cash_requests', 'l1_rejection_reason') IS NULL
BEGIN
    ALTER TABLE dbo.petty_cash_requests ADD l1_rejection_reason NVARCHAR(MAX) NULL;
END;
