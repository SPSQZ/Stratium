-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
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
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("companyId", "createdAt", "departmentId", "email", "id", "isDemoAccount", "name", "role", "title") SELECT "companyId", "createdAt", "departmentId", "email", "id", "isDemoAccount", "name", "role", "title" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
