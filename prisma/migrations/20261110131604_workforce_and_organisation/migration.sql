-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN "payrollEntryId" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN "payrollRunId" TEXT;

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "positionCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reportsToPositionId" TEXT,
    "roleLevel" TEXT NOT NULL DEFAULT 'STAFF',
    "mappedUserRole" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "approvalAuthoritySummary" TEXT NOT NULL DEFAULT 'Standard operational initiation',
    "maxApprovalAmount" REAL NOT NULL DEFAULT 0,
    "budgetResponsibility" TEXT NOT NULL DEFAULT '',
    "budgetId" TEXT,
    "requiredSkills" TEXT NOT NULL DEFAULT '',
    "qualifications" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'VACANT',
    "targetSalaryMin" REAL NOT NULL DEFAULT 0,
    "targetSalaryMax" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Position_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Position_reportsToPositionId_fkey" FOREIGN KEY ("reportsToPositionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Position_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PositionAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL DEFAULT 'PERMANENT',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "plannedEndDate" DATETIME,
    "transitionReason" TEXT NOT NULL DEFAULT '',
    "approvedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PositionAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PositionAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PositionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PositionAssignment_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmploymentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT,
    "eventType" TEXT NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "previousValueJson" TEXT NOT NULL DEFAULT '{}',
    "newValueJson" TEXT NOT NULL DEFAULT '{}',
    "reason" TEXT NOT NULL DEFAULT '',
    "approvalRef" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmploymentEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmploymentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmploymentEvent_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmploymentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeparationCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT,
    "separationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "noticeDate" DATETIME NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "proratedSalaryAmount" REAL NOT NULL DEFAULT 0,
    "leaveEncashmentAmount" REAL NOT NULL DEFAULT 0,
    "pendingBonusAmount" REAL NOT NULL DEFAULT 0,
    "outstandingDeductions" REAL NOT NULL DEFAULT 0,
    "finalSettlementNet" REAL NOT NULL DEFAULT 0,
    "assetsReturned" BOOLEAN NOT NULL DEFAULT false,
    "assetChecklistJson" TEXT NOT NULL DEFAULT '[]',
    "obligationsCleared" BOOLEAN NOT NULL DEFAULT false,
    "accessRevoked" BOOLEAN NOT NULL DEFAULT false,
    "accessRevokedAt" DATETIME,
    "finalPaymentRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeparationCase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeparationCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SeparationCase_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SeparationCase_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecruitmentRequisition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "departmentId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "candidateName" TEXT NOT NULL DEFAULT '',
    "candidateEmail" TEXT NOT NULL DEFAULT '',
    "offeredSalary" REAL NOT NULL DEFAULT 0,
    "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "targetStartDate" DATETIME,
    "replacingUserId" TEXT,
    "filledByUserId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecruitmentRequisition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequisition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequisition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequisition_replacingUserId_fkey" FOREIGN KEY ("replacingUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecruitmentRequisition_filledByUserId_fkey" FOREIGN KEY ("filledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompensationRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseSalary" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "payDayOfMonth" INTEGER NOT NULL DEFAULT 28,
    "allowances" REAL NOT NULL DEFAULT 0,
    "bonusTarget" REAL NOT NULL DEFAULT 0,
    "deductions" REAL NOT NULL DEFAULT 0,
    "benefitsSummary" TEXT NOT NULL DEFAULT '',
    "benefitsValue" REAL NOT NULL DEFAULT 0,
    "effectiveDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "reason" TEXT NOT NULL DEFAULT '',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompensationRevision_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompensationRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompensationRevision_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompensationRevision_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "runCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "payDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalBaseSalary" REAL NOT NULL DEFAULT 0,
    "totalAllowances" REAL NOT NULL DEFAULT 0,
    "totalBonuses" REAL NOT NULL DEFAULT 0,
    "totalDeductions" REAL NOT NULL DEFAULT 0,
    "totalBenefits" REAL NOT NULL DEFAULT 0,
    "totalNetPay" REAL NOT NULL DEFAULT 0,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "budgetId" TEXT,
    "createdById" TEXT NOT NULL,
    "financeApprovedById" TEXT,
    "financeApprovedAt" DATETIME,
    "execApprovedById" TEXT,
    "execApprovedAt" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollRun_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PayrollRun_financeApprovedById_fkey" FOREIGN KEY ("financeApprovedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PayrollRun_execApprovedById_fkey" FOREIGN KEY ("execApprovedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payrollRunId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "compensationRevisionId" TEXT,
    "baseSalary" REAL NOT NULL,
    "allowances" REAL NOT NULL DEFAULT 0,
    "bonus" REAL NOT NULL DEFAULT 0,
    "deductions" REAL NOT NULL DEFAULT 0,
    "benefitsValue" REAL NOT NULL DEFAULT 0,
    "grossPay" REAL NOT NULL,
    "netPay" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payoutEmail" TEXT NOT NULL DEFAULT '',
    "payslipNumber" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentRequestId" TEXT,
    "transactionId" TEXT,
    "paidAt" DATETIME,
    "providerReference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollEntry_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "employeeCode" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "employmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "joiningDate" DATETIME,
    "probationEndDate" DATETIME,
    "contractEndDate" DATETIME,
    "noticeStartDate" DATETIME,
    "separationDate" DATETIME,
    "separationType" TEXT,
    "reportingManagerId" TEXT,
    "location" TEXT NOT NULL DEFAULT 'HQ',
    "phone" TEXT NOT NULL DEFAULT '',
    "emergencyContact" TEXT NOT NULL DEFAULT '',
    "skillsSummary" TEXT NOT NULL DEFAULT '',
    "hrNotesRestricted" TEXT NOT NULL DEFAULT '',
    "accessStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "accessRevokedAt" DATETIME,
    "canAccessAdmin" BOOLEAN NOT NULL DEFAULT false,
    "canAccessHR" BOOLEAN NOT NULL DEFAULT false,
    "canAccessPayroll" BOOLEAN NOT NULL DEFAULT false,
    "permissionsInitialized" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "monthlySalary" REAL NOT NULL DEFAULT 0,
    "payCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "payDayOfMonth" INTEGER NOT NULL DEFAULT 28,
    "payoutEmail" TEXT NOT NULL DEFAULT '',
    "bankAccountRef" TEXT NOT NULL DEFAULT '',
    "nextPayDate" DATETIME,
    "payrollStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDemoAccount" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("bankAccountRef", "companyId", "createdAt", "departmentId", "email", "employmentType", "id", "isDemoAccount", "monthlySalary", "name", "nextPayDate", "payCycle", "payDayOfMonth", "payoutEmail", "payrollStatus", "role", "title") SELECT "bankAccountRef", "companyId", "createdAt", "departmentId", "email", "employmentType", "id", "isDemoAccount", "monthlySalary", "name", "nextPayDate", "payCycle", "payDayOfMonth", "payoutEmail", "payrollStatus", "role", "title" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE INDEX "User_companyId_employeeCode_idx" ON "User"("companyId", "employeeCode");
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Position_companyId_positionCode_key" ON "Position"("companyId", "positionCode");

-- CreateIndex
CREATE INDEX "PositionAssignment_companyId_positionId_isActive_idx" ON "PositionAssignment"("companyId", "positionId", "isActive");

-- CreateIndex
CREATE INDEX "PositionAssignment_companyId_userId_isActive_idx" ON "PositionAssignment"("companyId", "userId", "isActive");

-- CreateIndex
CREATE INDEX "EmploymentEvent_companyId_userId_createdAt_idx" ON "EmploymentEvent"("companyId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmploymentEvent_companyId_eventType_idx" ON "EmploymentEvent"("companyId", "eventType");

-- CreateIndex
CREATE INDEX "CompensationRevision_companyId_userId_effectiveDate_idx" ON "CompensationRevision"("companyId", "userId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_companyId_runCode_key" ON "PayrollRun"("companyId", "runCode");

-- CreateIndex
CREATE INDEX "PayrollEntry_companyId_userId_idx" ON "PayrollEntry"("companyId", "userId");

-- CreateIndex
CREATE INDEX "PayrollEntry_payrollRunId_idx" ON "PayrollEntry"("payrollRunId");
