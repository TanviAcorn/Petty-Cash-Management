# Database Migrations

This directory contains database migration scripts for the Petty Cash Management System.

## Available Migrations

### 1. Add Travel Details Column

**File:** `add_travel_details_column.sql`

**Purpose:** Adds a `travel_details` column to the `petty_cash_requests` table to store flight and accommodation booking information for travel-related requests.

**Column Details:**
- **Name:** `travel_details`
- **Type:** `NVARCHAR(MAX)`
- **Nullable:** `YES`
- **Format:** JSON string

**JSON Structure:**
```json
{
  "flight": {
    "id": "string",
    "airline": "string",
    "flightNumber": "string",
    "origin": "string",
    "destination": "string",
    "departureTime": "ISO 8601 datetime",
    "arrivalTime": "ISO 8601 datetime",
    "price": "number",
    "currency": "string"
  },
  "accommodation": {
    "id": "string",
    "name": "string",
    "address": "string",
    "checkInDate": "YYYY-MM-DD",
    "checkOutDate": "YYYY-MM-DD",
    "nights": "number",
    "pricePerNight": "number",
    "totalPrice": "number",
    "currency": "string"
  },
  "totalCost": "number"
}
```

## Running Migrations

### Method 1: Using the Migration Runner

```bash
node src/migrations/runMigration.js add_travel_details_column.sql
```

### Method 2: Direct SQL Execution

Execute the SQL file directly against your database using SQL Server Management Studio or Azure Data Studio.

### Method 3: Automatic Migration

The application automatically ensures the `travel_details` column exists when creating new requests. The `ensureTravelDetailsColumn()` function in `src/routes/requests.js` handles this.

## Verification

To verify the migration was successful:

```bash
node verify-schema.js
```

Or query the database directly:

```sql
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'petty_cash_requests' 
AND COLUMN_NAME = 'travel_details';
```

## Rollback

To remove the `travel_details` column (not recommended after data is stored):

```sql
ALTER TABLE petty_cash_requests
DROP COLUMN travel_details;
```

## Notes

- The migration is idempotent - it can be run multiple times safely
- The column is nullable to maintain backward compatibility with existing requests
- The application handles both requests with and without travel details
