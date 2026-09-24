-- =========================================================================================
-- IMSERP - Seed Demo Expense Vouchers & Fixed Asset Ledgers Script
-- Description: Inserts realistic operational expense vouchers across multiple categories
--              and updates fixed asset valuations in Chart of Accounts for ALL active tenants.
-- Target Database: SQL Server (IMSERPDb)
-- =========================================================================================

SET NOCOUNT ON;
PRINT '-------------------------------------------------------------';
PRINT 'Starting IMSERP Finance Demo Data Seeding for All Tenants...';
PRINT '-------------------------------------------------------------';

DECLARE @TenantId UNIQUEIDENTIFIER;
DECLARE @BranchId UNIQUEIDENTIFIER;
DECLARE @CurrentDate DATETIME2 = SYSUTCDATETIME();

-- Helper Variables for Category IDs
DECLARE @CatUtil UNIQUEIDENTIFIER, @CatRent UNIQUEIDENTIFIER, @CatFuel UNIQUEIDENTIFIER;
DECLARE @CatAcad UNIQUEIDENTIFIER, @CatAdv UNIQUEIDENTIFIER, @CatMaint UNIQUEIDENTIFIER;
DECLARE @CatIT UNIQUEIDENTIFIER, @CatPantry UNIQUEIDENTIFIER, @CatMisc UNIQUEIDENTIFIER;

-- Cursor to iterate through ALL active tenants (Apex School Academy, Demo, Saraswati, etc.)
DECLARE TenantCursor CURSOR FOR 
    SELECT [Id] FROM [dbo].[Tenants] WHERE [IsActive] = 1;

OPEN TenantCursor;
FETCH NEXT FROM TenantCursor INTO @TenantId;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Fetch primary branch for this tenant
    SELECT TOP 1 @BranchId = [Id] FROM [dbo].[Branches] WHERE [TenantId] = @TenantId AND [IsActive] = 1;

    PRINT '>> Processing Tenant ID: ' + CAST(@TenantId AS NVARCHAR(50));

    -- Get Category IDs for this tenant
    SELECT @CatUtil = [Id] FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'UTIL';
    SELECT @CatRent = [Id] FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'RENT';
    SELECT @CatFuel = [Id] FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'FUEL';
    SELECT @CatAcad = [Id] FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'ACAD';
    SELECT @CatAdv = [Id] FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'ADV';
    SELECT @CatMaint = [Id] FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'MAINT';
    SELECT @CatIT = [Id] FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'IT';
    SELECT @CatPantry = [Id] FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'PANTRY';
    SELECT @CatMisc = [Id] FROM [dbo].[ExpenseCategories] WHERE [TenantId] = @TenantId AND [Code] = 'MISC';

    -- Voucher 1: Electricity Bill
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @TenantId AND [VoucherNo] = 'EXP-202609-0001')
        INSERT INTO [dbo].[ExpenseVouchers] 
        ([TenantId], [BranchId], [VoucherNo], [ExpenseDate], [ExpenseCategoryId], [Title], [Amount], [PaymentMode], [VendorName], [BillInvoiceNo], [Description], [CreatedAt])
        VALUES 
        (@TenantId, @BranchId, 'EXP-202609-0001', DATEADD(DAY, -2, @CurrentDate), @CatUtil, 
         'Campus Electricity Bill - Main Meter', 12450.00, 3, 'State Electricity Board', 'EB-98214', 'Monthly electrical power consumption for classrooms, labs and ACs', DATEADD(DAY, -2, @CurrentDate));

    -- Voucher 2: Campus Building Rent
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @TenantId AND [VoucherNo] = 'EXP-202609-0002')
        INSERT INTO [dbo].[ExpenseVouchers] 
        ([TenantId], [BranchId], [VoucherNo], [ExpenseDate], [ExpenseCategoryId], [Title], [Amount], [PaymentMode], [VendorName], [BillInvoiceNo], [Description], [CreatedAt])
        VALUES 
        (@TenantId, @BranchId, 'EXP-202609-0002', @CurrentDate, @CatRent, 
         'Monthly Building Lease & Campus Rent', 25000.00, 3, 'Greenwood Commercial Properties', 'RENT-SEP26', 'Institutional premises lease payment for coaching and academy wing', @CurrentDate);

    -- Voucher 3: Bus Diesel & Fuel
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @TenantId AND [VoucherNo] = 'EXP-202609-0003')
        INSERT INTO [dbo].[ExpenseVouchers] 
        ([TenantId], [BranchId], [VoucherNo], [ExpenseDate], [ExpenseCategoryId], [Title], [Amount], [PaymentMode], [VendorName], [BillInvoiceNo], [Description], [CreatedAt])
        VALUES 
        (@TenantId, @BranchId, 'EXP-202609-0003', DATEADD(DAY, -3, @CurrentDate), @CatFuel, 
         'School Bus Diesel Fuel - Route 1 & 2', 8600.00, 2, 'Bharat Petroleum Service Station', 'INV-BPCL-441', '100 Liters Diesel fuel for student bus pickup fleet', DATEADD(DAY, -3, @CurrentDate));

    -- Voucher 4: Term Examination Question Paper Printing
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @TenantId AND [VoucherNo] = 'EXP-202609-0004')
        INSERT INTO [dbo].[ExpenseVouchers] 
        ([TenantId], [BranchId], [VoucherNo], [ExpenseDate], [ExpenseCategoryId], [Title], [Amount], [PaymentMode], [VendorName], [BillInvoiceNo], [Description], [CreatedAt])
        VALUES 
        (@TenantId, @BranchId, 'EXP-202609-0004', DATEADD(DAY, -4, @CurrentDate), @CatAcad, 
         'Term Exam Question Papers & Answer Booklets Printing', 4850.00, 1, 'Apex Quick Printers', 'BILL-PR-339', 'Bulk printing of 1500 question sheets and answer booklets for Half-Yearly exams', DATEADD(DAY, -4, @CurrentDate));

    -- Voucher 5: Admission Campaign Pamphlets & Flex Banners
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @TenantId AND [VoucherNo] = 'EXP-202609-0005')
        INSERT INTO [dbo].[ExpenseVouchers] 
        ([TenantId], [BranchId], [VoucherNo], [ExpenseDate], [ExpenseCategoryId], [Title], [Amount], [PaymentMode], [VendorName], [BillInvoiceNo], [Description], [CreatedAt])
        VALUES 
        (@TenantId, @BranchId, 'EXP-202609-0005', DATEADD(DAY, -6, @CurrentDate), @CatAdv, 
         'Admission Banners & City Hoardings', 6500.00, 2, 'City Graphics & Outdoor Media', 'CG-8821', 'Design and installation of 4 roadside flex hoardings and 2000 flyers', DATEADD(DAY, -6, @CurrentDate));

    -- Voucher 6: Classroom AC & Electrical Repairs
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @TenantId AND [VoucherNo] = 'EXP-202609-0006')
        INSERT INTO [dbo].[ExpenseVouchers] 
        ([TenantId], [BranchId], [VoucherNo], [ExpenseDate], [ExpenseCategoryId], [Title], [Amount], [PaymentMode], [VendorName], [BillInvoiceNo], [Description], [CreatedAt])
        VALUES 
        (@TenantId, @BranchId, 'EXP-202609-0006', DATEADD(DAY, -1, @CurrentDate), @CatMaint, 
         'Room 102 Split AC Gas Refilling & Servicing', 2300.00, 1, 'Cool Point Electricals', 'REC-AC-09', 'Compressor gas top-up and filter cleaning for Classroom 102', DATEADD(DAY, -1, @CurrentDate));

    -- Voucher 7: Broadband Internet & Cloud Hosting
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @TenantId AND [VoucherNo] = 'EXP-202609-0007')
        INSERT INTO [dbo].[ExpenseVouchers] 
        ([TenantId], [BranchId], [VoucherNo], [ExpenseDate], [ExpenseCategoryId], [Title], [Amount], [PaymentMode], [VendorName], [BillInvoiceNo], [Description], [CreatedAt])
        VALUES 
        (@TenantId, @BranchId, 'EXP-202609-0007', DATEADD(DAY, -7, @CurrentDate), @CatIT, 
         'High-Speed 200Mbps Leased Line Internet', 3540.00, 3, 'Airtel Enterprise Broadband', 'INV-AIR-9921', 'Monthly commercial fiber internet subscription for smart classrooms', DATEADD(DAY, -7, @CurrentDate));

    -- Voucher 8: Staff Tea, Coffee & Meeting Refreshments
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @TenantId AND [VoucherNo] = 'EXP-202609-0008')
        INSERT INTO [dbo].[ExpenseVouchers] 
        ([TenantId], [BranchId], [VoucherNo], [ExpenseDate], [ExpenseCategoryId], [Title], [Amount], [PaymentMode], [VendorName], [BillInvoiceNo], [Description], [CreatedAt])
        VALUES 
        (@TenantId, @BranchId, 'EXP-202609-0008', @CurrentDate, @CatPantry, 
         'Weekly Faculty Tea & Refreshments', 1750.00, 1, 'Deepak Cafeteria & Pantry', 'CASH-REF-14', 'Daily morning & evening tea, snacks and 20L mineral water jars', @CurrentDate);

    -- Voucher 9: Science Lab Consumables & Chemicals
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @TenantId AND [VoucherNo] = 'EXP-202609-0009')
        INSERT INTO [dbo].[ExpenseVouchers] 
        ([TenantId], [BranchId], [VoucherNo], [ExpenseDate], [ExpenseCategoryId], [Title], [Amount], [PaymentMode], [VendorName], [BillInvoiceNo], [Description], [CreatedAt])
        VALUES 
        (@TenantId, @BranchId, 'EXP-202609-0009', DATEADD(DAY, -8, @CurrentDate), @CatAcad, 
         'Physics & Chemistry Lab Apparatus and Reagents', 3200.00, 2, 'Standard Scientific Co.', 'INV-SCI-412', 'Test tubes, litmus papers, dilute acids and optical prisms for senior lab', DATEADD(DAY, -8, @CurrentDate));

    -- Voucher 10: First Aid & Medical Room Supplies
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ExpenseVouchers] WHERE [TenantId] = @TenantId AND [VoucherNo] = 'EXP-202609-0010')
        INSERT INTO [dbo].[ExpenseVouchers] 
        ([TenantId], [BranchId], [VoucherNo], [ExpenseDate], [ExpenseCategoryId], [Title], [Amount], [PaymentMode], [VendorName], [BillInvoiceNo], [Description], [CreatedAt])
        VALUES 
        (@TenantId, @BranchId, 'EXP-202609-0010', DATEADD(DAY, -9, @CurrentDate), @CatMisc, 
         'Campus Infirmary & Emergency First Aid Kit Replenishment', 1250.00, 1, 'Apollo Pharmacy', 'INV-AP-8812', 'Antiseptic bandages, Dettol, pain relief sprays, thermometers and ORS', DATEADD(DAY, -9, @CurrentDate));

    -- Update Chart of Accounts (AccountLedgers) for this tenant
    UPDATE [dbo].[AccountLedgers]
    SET [OpeningBalance] = 2500000.00, [CurrentBalance] = 2500000.00
    WHERE [TenantId] = @TenantId AND [AccountCode] = 'FA-BLDG';

    UPDATE [dbo].[AccountLedgers]
    SET [OpeningBalance] = 850000.00, [CurrentBalance] = 850000.00
    WHERE [TenantId] = @TenantId AND [AccountCode] = 'FA-VEH';

    UPDATE [dbo].[AccountLedgers]
    SET [OpeningBalance] = 320000.00, [CurrentBalance] = 320000.00
    WHERE [TenantId] = @TenantId AND [AccountCode] = 'FA-FURN';

    UPDATE [dbo].[AccountLedgers]
    SET [OpeningBalance] = 480000.00, [CurrentBalance] = 480000.00
    WHERE [TenantId] = @TenantId AND [AccountCode] = 'FA-COMP';

    UPDATE [dbo].[AccountLedgers]
    SET [OpeningBalance] = 60000.00, [CurrentBalance] = 60000.00
    WHERE [TenantId] = @TenantId AND [AccountCode] = 'CL-CAUTION';

    UPDATE [dbo].[AccountLedgers]
    SET [OpeningBalance] = 450000.00, [CurrentBalance] = 450000.00
    WHERE [TenantId] = @TenantId AND [AccountCode] = 'LL-LOAN';

    UPDATE [dbo].[AccountLedgers]
    SET [OpeningBalance] = 3640000.00, [CurrentBalance] = 3640000.00
    WHERE [TenantId] = @TenantId AND [AccountCode] = 'EQ-CAPITAL';

    PRINT '>> Successfully seeded data for Tenant ID: ' + CAST(@TenantId AS NVARCHAR(50));

    FETCH NEXT FROM TenantCursor INTO @TenantId;
END

CLOSE TenantCursor;
DEALLOCATE TenantCursor;

PRINT '-------------------------------------------------------------';
PRINT 'Finance Demo Data Seeding Completed for ALL Tenants!';
PRINT '-------------------------------------------------------------';
