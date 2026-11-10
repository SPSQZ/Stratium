import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function relativeDate(daysOffset: number, hour = 10): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  return d;
}

function teslaDate(daysOffset: number, hour = 10): Date {
  const d = new Date("2012-11-15T00:00:00.000Z");
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d;
}

async function main() {
  console.log("Seeding Stratium corporate intelligence & finance database...");

  // Clear existing data safely in dependency order
  await prisma.auditLog.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.approvalAction.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.paymentRequest.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.strategicScenario.deleteMany();
  await prisma.strategicDecision.deleteMany();
  await prisma.boardroomMessage.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.approvalPolicy.deleteMany();
  await prisma.documentChunk.deleteMany();
  await prisma.companyDocument.deleteMany();
  await prisma.companyProfileSection.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.company.deleteMany();

  // =========================================================================
  // COMPANY 1: TESLA MOTORS (HISTORICAL SIMULATION · CUTOFF DEC 31, 2012)
  // =========================================================================
  const tesla = await prisma.company.create({
    data: {
      slug: "tesla-2012-sim",
      name: "Tesla Motors, Inc. (2012 Sim)",
      industry: "Electric Vehicles & Energy Powertrain Manufacturing",
      businessModel:
        "Direct-to-consumer electric vehicle sales, proprietary battery/powertrain engineering, OEM powertrain supply partnerships, and nascent fast-charging corridor infrastructure.",
      description:
        "Historical simulation workspace grounded strictly in public Tesla Motors filings and announcements up to December 31, 2012. Designed to test boardroom capital allocation, Model S production ramp trade-offs, and early Supercharger corridor planning alongside synthetic operational ledgers.",
      operatingRegions: "North America (Palo Alto HQ, Fremont Factory, California Retail/Service), Europe (select Roadster/Model S reservation markets)",
      companySize: "~2,500–3,000 employees (late-2012 public estimate during Fremont ramp)",
      strategicObjectives:
        "1) Ramp Model S production at Fremont toward 20,000 units/year run-rate; 2) Achieve positive gross margin moving toward ~25% target in 2013; 3) Launch initial California/US Supercharger fast-charging corridors; 4) Conserve liquidity following Oct 2012 equity raise.",
      productsAndServices:
        "Tesla Model S (60 kWh & 85 kWh sedans, launched June 22, 2012), Tesla Roadster (2008–Jan 2012 production completed), OEM Electric Powertrains (Toyota RAV4 EV, Daimler), Supercharger 90–120 kW DC Fast Charging Pilot (announced Sept 24, 2012).",
      customerSegments:
        "Affluent early-adopter luxury sedan buyers, zero-emission tech executives, fleet sustainability buyers, OEM automotive partners.",
      competitorsSummary:
        "Nissan Leaf, Chevrolet Volt (GM), Fisker Karma (experiencing 2012 supply/battery challenges), BMW i3 concept, and established luxury ICE sedans (BMW 5/7-Series, Mercedes E/S-Class, Audi A6/A8).",
      historicalCutoffDate: "2012-12-31",
      isHistoricalDemo: true,
      syntheticDataNotice:
        "Public company facts are strictly capped at Dec 31, 2012. Internal org hierarchy, invoices, budgets, payment requests, and operational transactions are SYNTHETIC DEMO RECORDS anchored in Q4 2012 (Nov–Dec 2012).",
      currency: "USD",
      recordedCashBalance: 24850000,
      recordedBalanceSource:
        "Synthetic Operational Demo Treasury Pool (Nov 2012 allocation from post-Oct 2012 liquidity)",
    },
  });

  // Departments
  const tExec = await prisma.department.create({
    data: {
      companyId: tesla.id,
      name: "Executive Leadership",
      code: "EXEC",
      headTitle: "Chief Executive Officer",
      description: "Board governance, long-term vehicle roadmap, and strategic partnerships.",
    },
  });
  const tFinance = await prisma.department.create({
    data: {
      companyId: tesla.id,
      name: "Finance & Treasury",
      code: "FIN",
      parentDepartmentId: tExec.id,
      headTitle: "Chief Financial Officer",
      description: "Capital liquidity, DOE loan compliance, payables, receivables, and gross margin tracking.",
    },
  });
  const tTech = await prisma.department.create({
    data: {
      companyId: tesla.id,
      name: "Supercharger & Powertrain Engineering",
      code: "TECH",
      parentDepartmentId: tExec.id,
      headTitle: "Chief Technology Officer",
      description: "Battery pack architecture, power electronics, 480V DC Supercharger hardware, and grid interconnect engineering.",
    },
  });
  const tOps = await prisma.department.create({
    data: {
      companyId: tesla.id,
      name: "Fremont Manufacturing & Operations",
      code: "OPS",
      parentDepartmentId: tExec.id,
      headTitle: "VP Operations",
      description: "Fremont assembly line ramp, body/stamping tooling, logistics, and service center operations.",
    },
  });
  const tHR = await prisma.department.create({
    data: {
      companyId: tesla.id,
      name: "Human Resources",
      code: "HR",
      parentDepartmentId: tExec.id,
      headTitle: "HR Manager",
      description: "Technical recruiting for Fremont ramp, compensation bands, and safety compliance.",
      confidentialScope: true,
    },
  });

  // Demo Users covering all 12 RBAC roles (Synthetic Demo Profiles)
  const tUsers = {
    board: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tExec.id,
        name: "Eleanor Vance (Demo)",
        email: "board.demo@tesla-sim.local",
        title: "Independent Board Director",
        role: "BOARD_MEMBER",
        employmentType: "EXECUTIVE",
        monthlySalary: 0,
        payCycle: "MONTHLY",
        payDayOfMonth: 28,
        payoutEmail: "board.demo@tesla-sim.local",
        payrollStatus: "UNSCHEDULED",
      },
    }),
    ceo: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tExec.id,
        name: "Marcus Sterling (Demo CEO)",
        email: "ceo.demo@tesla-sim.local",
        title: "Chief Executive Officer",
        role: "CEO",
        employmentType: "EXECUTIVE",
        monthlySalary: 18500,
        payCycle: "MONTHLY",
        payDayOfMonth: 28,
        payoutEmail: "ceo.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-28T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
    cfo: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tFinance.id,
        name: "Deepak Kulkarni (Demo CFO)",
        email: "cfo.demo@tesla-sim.local",
        title: "Chief Financial Officer",
        role: "CFO",
        employmentType: "EXECUTIVE",
        monthlySalary: 16500,
        payCycle: "MONTHLY",
        payDayOfMonth: 28,
        payoutEmail: "cfo.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-28T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
    cto: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tTech.id,
        name: "J.B. Carter (Demo CTO)",
        email: "cto.demo@tesla-sim.local",
        title: "Chief Technology Officer",
        role: "CTO",
        employmentType: "EXECUTIVE",
        monthlySalary: 16500,
        payCycle: "MONTHLY",
        payDayOfMonth: 28,
        payoutEmail: "cto.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-28T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
    deptHeadOps: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tOps.id,
        name: "Rachel Morales (Demo Dept Head)",
        email: "ops.head.demo@tesla-sim.local",
        title: "VP Manufacturing & Operations",
        role: "DEPARTMENT_HEAD",
        employmentType: "FULL_TIME",
        monthlySalary: 14000,
        payCycle: "MONTHLY",
        payDayOfMonth: 28,
        payoutEmail: "ops.head.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-28T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
    finMgr: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tFinance.id,
        name: "Claire Lin (Demo Finance Mgr)",
        email: "finance.mgr.demo@tesla-sim.local",
        title: "Corporate Finance Manager",
        role: "FINANCE_MANAGER",
        employmentType: "FULL_TIME",
        monthlySalary: 11200,
        payCycle: "MONTHLY",
        payDayOfMonth: 28,
        payoutEmail: "finance.mgr.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-28T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
    hrMgr: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tHR.id,
        name: "David Brooks (Demo HR Mgr)",
        email: "hr.mgr.demo@tesla-sim.local",
        title: "HR & Recruiting Manager",
        role: "HR_MANAGER",
        employmentType: "FULL_TIME",
        monthlySalary: 10500,
        payCycle: "MONTHLY",
        payDayOfMonth: 28,
        payoutEmail: "hr.mgr.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-28T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
    deptMgrTech: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tTech.id,
        name: "Sanjay Rao (Demo Grid Mgr)",
        email: "grid.mgr.demo@tesla-sim.local",
        title: "Supercharger Engineering Manager",
        role: "DEPARTMENT_MANAGER",
        employmentType: "FULL_TIME",
        monthlySalary: 12500,
        payCycle: "BIWEEKLY",
        payDayOfMonth: 15,
        payoutEmail: "grid.mgr.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-29T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
    empTech: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tTech.id,
        name: "Hannah Park (Demo Engineer)",
        email: "eng.demo@tesla-sim.local",
        title: "Power Electronics Engineer",
        role: "EMPLOYEE",
        employmentType: "FULL_TIME",
        monthlySalary: 9500,
        payCycle: "BIWEEKLY",
        payDayOfMonth: 15,
        payoutEmail: "eng.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-29T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
    auditor: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tFinance.id,
        name: "Arthur Pendelton (Demo Auditor)",
        email: "auditor.demo@tesla-sim.local",
        title: "Internal Compliance Auditor",
        role: "AUDITOR",
        employmentType: "CONTRACTOR",
        monthlySalary: 8200,
        payCycle: "MONTHLY",
        payDayOfMonth: 28,
        payoutEmail: "auditor.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-28T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
    admin: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tExec.id,
        name: "Nadia Chen (Demo Admin)",
        email: "admin.demo@tesla-sim.local",
        title: "Platform Administrator",
        role: "ADMINISTRATOR",
        employmentType: "FULL_TIME",
        monthlySalary: 10800,
        payCycle: "MONTHLY",
        payDayOfMonth: 28,
        payoutEmail: "admin.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-28T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
    executor: await prisma.user.create({
      data: {
        companyId: tesla.id,
        departmentId: tFinance.id,
        name: "Trevor Mills (Demo Executor)",
        email: "treasury.exec.demo@tesla-sim.local",
        title: "Treasury Payment Executor",
        role: "PAYMENT_EXECUTOR",
        employmentType: "FULL_TIME",
        monthlySalary: 9800,
        payCycle: "MONTHLY",
        payDayOfMonth: 28,
        payoutEmail: "treasury.exec.demo@tesla-sim.local",
        nextPayDate: new Date("2012-11-28T12:00:00.000Z"),
        payrollStatus: "ACTIVE",
      },
    }),
  };

  // Company Intelligence Sections (Strict Public <= Dec 2012 vs Synthetic clearly distinguished)
  await prisma.companyProfileSection.createMany({
    data: [
      {
        companyId: tesla.id,
        category: "STRATEGY",
        title: "Public Strategic Roadmap (2010–2012 Secret Master Plan Trajectory)",
        summary: "Transition from high-priced Roadster to Model S premium sedan while building direct retail and early charging corridors.",
        content:
          "Following its June 2010 NASDAQ IPO and acquisition of the Fremont NUMMI facility, Tesla Motors focused 2011–2012 capital on bringing the Model S to volume production. Key 2012 strategic pillars: (1) execute Model S deliveries starting June 22, 2012; (2) eliminate EV range anxiety via proprietary solar-assisted Supercharger highway stations announced Sept 24, 2012; (3) supply OEM electric powertrains (Toyota RAV4 EV, Daimler) for early revenue diversification.",
        sourceType: "PUBLIC_HISTORICAL",
        sourceCitation: "Tesla Motors Public Filings & Press Releases (2010–Nov 2012)",
        verificationStatus: "VERIFIED_PUBLIC",
        effectiveDate: "2012-11-30",
        accessLevel: "COMPANY_WIDE",
      },
      {
        companyId: tesla.id,
        category: "PRODUCTS_TECH",
        title: "Model S Launch, Roadster Sunset & Sept 2012 Supercharger Spec",
        summary: "Model S deliveries began June 22, 2012; initial 6 California Superchargers unveiled Sept 24, 2012.",
        content:
          "Roadster production ended in January 2012 (~2,450 total vehicles delivered worldwide). Model S launched commercially on June 22, 2012 with 60 kWh and 85 kWh battery options (EPA 265-mile range on 85 kWh) and won Motor Trend 2013 Car of the Year in November 2012. On September 24, 2012, Tesla unveiled its first 6 Supercharger stations in California (Hawthorne, Harris Ranch, Barstow, Folsom, Gilroy, Tejon Ranch) delivering ~90–100 kW DC fast charging (upgradable toward 120 kW), free to Model S 85 kWh owners.",
        sourceType: "PUBLIC_HISTORICAL",
        sourceCitation: "Tesla Sept 24, 2012 Supercharger Press Release & Q3 2012 Shareholder Letter",
        verificationStatus: "VERIFIED_PUBLIC",
        effectiveDate: "2012-11-15",
        accessLevel: "COMPANY_WIDE",
      },
      {
        companyId: tesla.id,
        category: "FINANCIALS",
        title: "Public Financial Context Through Q3/Q4 2012",
        summary: "FY2011 revenue $204.2M (net loss $254.4M); Q3 2012 revenue $50.1M; Oct 2012 equity raise (~$213M net).",
        content:
          "Verified public figures up to Dec 2012: FY2011 total revenue was $204.2M with GAAP net loss of $254.4M due to Model S R&D and Fremont tooling. In Q3 2012 (ended Sept 30, 2012), revenue was $50.1M, automotive gross margin remained negative during the initial low-volume Fremont ramp, and Sept 30 cash & equivalents were ~$85.7M. In October 2012, Tesla completed a follow-on public equity offering raising ~$222M gross (~$213M net) to bolster working capital alongside remaining DOE ATVM loan terms. Management publicly targeted ~25% Model S gross margin in 2013 at 20,000 units/year run rate.",
        sourceType: "PUBLIC_HISTORICAL",
        sourceCitation: "Tesla Motors Form 10-K (FY2011), Form 10-Q (Q3 2012), Oct 2012 Offering Prospectus",
        verificationStatus: "VERIFIED_PUBLIC",
        effectiveDate: "2012-10-31",
        accessLevel: "COMPANY_WIDE",
      },
      {
        companyId: tesla.id,
        category: "COMPETITORS",
        title: "Competitive Landscape (Cutoff: December 2012)",
        summary: "EV peers Nissan Leaf, Chevy Volt, Fisker Karma; luxury incumbents BMW 5/7, Mercedes E/S-Class.",
        content:
          "As of December 2012: Nissan Leaf offered ~73 miles EPA range in mass-market compact segment; Chevrolet Volt offered ~38 miles EV + gas range-extender; Fisker Karma faced severe 2012 battery supplier (A123 Systems bankruptcy) and recall challenges; BMW i3 remained pre-production concept. Tesla's primary Model S purchase consideration competed against conventional luxury sedans (BMW 5/7-Series, Mercedes E/S-Class, Audi A6/A8), making interstate fast-charging availability critical for primary-car adoption.",
        sourceType: "PUBLIC_HISTORICAL",
        sourceCitation: "2012 Automotive Industry Reports & Tesla Q3 2012 Market Commentary",
        verificationStatus: "VERIFIED_PUBLIC",
        effectiveDate: "2012-12-01",
        accessLevel: "COMPANY_WIDE",
      },
      {
        companyId: tesla.id,
        departmentId: tOps.id,
        category: "OPERATIONS",
        title: "Fremont Production Ramp & Supercharger Field Constraints (Synthetic Internal Memo)",
        summary: "Fremont line ramp requires stabilizing body-in-white throughput before diverting engineering to civil site builds.",
        content:
          "[SYNTHETIC DEMO RECORD] Internal operations assessment indicates Fremont assembly yields improved in late Q4, but power electronics engineers and field service technicians remain heavily allocated to Model S commissioning. Each 4–8 stall Supercharger site requires utility 480V transformer interconnection (14–24 week utility lead time), municipal permitting, concrete trenching, and ~$150K–$185K turnkey equipment + civil CapEx.",
        sourceType: "SYNTHETIC_DEMO",
        sourceCitation: "Synthetic Ops Memo OPS-2012-Q4",
        verificationStatus: "SYNTHETIC_RECORD",
        effectiveDate: "2012-12-10",
        accessLevel: "COMPANY_WIDE",
      },
      {
        companyId: tesla.id,
        departmentId: tFinance.id,
        category: "RISKS",
        title: "Treasury Liquidity Covenant & CapEx Gating Policy (Synthetic Finance Brief)",
        summary: "CFO recommends keeping minimum $15M operational treasury reserve buffer and gating corridor CapEx.",
        content:
          "[SYNTHETIC DEMO RECORD] Finance modeling flags that committing >$10M in upfront un-gated Supercharger civil works before Fremont achieves positive unit gross margin could compress operational liquidity cushions if delivery ramp slips by even 6 weeks. Recommends milestone-gated Phase 1 tranches.",
        sourceType: "SYNTHETIC_DEMO",
        sourceCitation: "Synthetic Treasury Risk Brief FIN-RISK-09",
        verificationStatus: "SYNTHETIC_RECORD",
        effectiveDate: "2012-12-12",
        accessLevel: "FINANCE_AND_EXEC",
      },
      {
        companyId: tesla.id,
        departmentId: tHR.id,
        category: "WORKFORCE",
        title: "Confidential Executive & Ramp Compensation Bands (Synthetic HR Restricted)",
        summary: "Restricted HR planning schedule for specialized HV battery and manufacturing leads.",
        content:
          "[SYNTHETIC DEMO RECORD — HR RESTRICTED] Retention equity grants and specialized high-voltage electrical technician overtime allocations for Fremont Q1 shifts total $1.85M in projected payroll adjustments. Accessible exclusively to HR Manager, CEO, and Auditor.",
        sourceType: "SYNTHETIC_DEMO",
        sourceCitation: "Synthetic HR Comp Schedule HR-CONF-2012",
        verificationStatus: "SYNTHETIC_RECORD",
        effectiveDate: "2012-12-15",
        accessLevel: "HR_RESTRICTED",
      },
      {
        companyId: tesla.id,
        category: "CUSTOMERS",
        title: "Model S Reservation Backlog & Fleet Inquiries",
        summary: "Over 13,000 net Model S reservations reported publicly in Q3 2012; early coastal reservation concentration.",
        content:
          "Public Q3 2012 shareholder reporting noted >13,000 net Model S reservations across 60 kWh and 85 kWh trims. Synthetic CRM segmentation notes strong reservation density along I-5 / US-101 California corridors and Northeast I-95 corridor, where multi-city travel reliability drives cancellation vs. conversion rates.",
        sourceType: "PUBLIC_HISTORICAL",
        sourceCitation: "Tesla Q3 2012 Shareholder Letter + Synthetic CRM Tagging",
        verificationStatus: "VERIFIED_PUBLIC",
        effectiveDate: "2012-11-05",
        accessLevel: "COMPANY_WIDE",
      },
      {
        companyId: tesla.id,
        category: "HISTORICAL_DECISIONS",
        title: "Initial 6-Station California Supercharger Pilot Approval",
        summary: "Board authorized initial 6 California corridor pilot sites prior to national expansion commitment.",
        content:
          "Prior authorization funded the initial 6 California stations (Hawthorne, Harris Ranch, Barstow, Folsom, Gilroy, Tejon Ranch) to validate 90–120 kW charging hardware, site-host leases, and driver utilization before committing capital to cross-country corridors.",
        sourceType: "PUBLIC_HISTORICAL",
        sourceCitation: "Tesla Sept 2012 Announcement & Board Memory",
        verificationStatus: "VERIFIED_PUBLIC",
        effectiveDate: "2012-09-24",
        accessLevel: "COMPANY_WIDE",
      },
    ],
  });

  // Seeded Company Documents + Chunks for RAG search
  const docPublic = await prisma.companyDocument.create({
    data: {
      companyId: tesla.id,
      uploadedById: tUsers.cfo.id,
      fileName: "Tesla_Q3_2012_Public_Financial_Summary.txt",
      fileType: "SEED",
      fileSizeBytes: 2140,
      sourceLabel: "SEC Form 10-Q / Shareholder Letter (Nov 2012)",
      sourceType: "PUBLIC_HISTORICAL",
      verificationStatus: "VERIFIED_PUBLIC",
      extractionStatus: "COMPLETED",
      extractedSummary:
        "Public financial snapshot up to Q3/Oct 2012: $50.1M Q3 revenue, negative early Model S ramp margin, ~$85.7M Sept 30 cash plus ~$213M net Oct follow-on equity raise, >13,000 net reservations.",
      associatedInfo: "Category: FINANCIALS · Cutoff <= 2012-12-31",
      accessLevel: "COMPANY_WIDE",
      chunks: {
        create: [
          {
            companyId: tesla.id,
            category: "FINANCIALS",
            chunkIndex: 0,
            content:
              "Tesla Motors Q3 2012 reported total revenue of $50.1M, GAAP net loss of $110.8M, and negative automotive gross margin due to low early Model S manufacturing volume and fixed Fremont overhead absorption. Cash and cash equivalents were ~$85.7M at September 30, 2012, supplemented in October 2012 by a follow-on public offering generating ~$213M in net proceeds.",
            accessLevel: "COMPANY_WIDE",
          },
          {
            companyId: tesla.id,
            category: "PRODUCTS_TECH",
            chunkIndex: 1,
            content:
              "Model S production rate reached 200+ cars/week in late Q4 2012 toward an annualized 20,000 unit 2013 run-rate goal. Management targeted 25% Model S gross margin in 2013 once supplier volume pricing and assembly efficiency stabilized.",
            accessLevel: "COMPANY_WIDE",
          },
        ],
      },
    },
  });

  await prisma.companyDocument.create({
    data: {
      companyId: tesla.id,
      departmentId: tTech.id,
      uploadedById: tUsers.cto.id,
      fileName: "Supercharger_Engineering_Cost_Model_Synthetic.csv",
      fileType: "SEED",
      fileSizeBytes: 1480,
      sourceLabel: "Synthetic Engineering Spec (Demo)",
      sourceType: "SYNTHETIC_DEMO",
      verificationStatus: "SYNTHETIC_RECORD",
      extractionStatus: "COMPLETED",
      extractedSummary:
        "Unit economics per 6-stall Supercharger station: $165,000 average turnkey CapEx ($95k power cabinets/pedestals, $45k civil/trenching, $25k utility interconnect), $18,500/yr maintenance & demand-charge OpEx, 16–24 week permitting lead time.",
      associatedInfo: "Category: PRODUCTS_TECH · Synthetic Unit Economics",
      accessLevel: "COMPANY_WIDE",
      chunks: {
        create: [
          {
            companyId: tesla.id,
            departmentId: tTech.id,
            category: "PRODUCTS_TECH",
            chunkIndex: 0,
            content:
              "Synthetic Supercharger Station BOM (2012 Pilot Spec): 6 DC fast-charge stalls utilizing paired Model S twin-charger modules (~90-100 kW initial peak). Turnkey station CapEx averages $165,000 ($95,000 rectifier/charging hardware, $45,000 site civil/concrete, $25,000 utility transformer interconnect). Annual OpEx including utility demand charges, lease maintenance, and network telemetry averages $18,500 per station.",
            accessLevel: "COMPANY_WIDE",
          },
        ],
      },
    },
  });

  await prisma.companyDocument.create({
    data: {
      companyId: tesla.id,
      departmentId: tHR.id,
      uploadedById: tUsers.hrMgr.id,
      fileName: "Fremont_Confidential_Comp_Bands_Synthetic.pdf",
      fileType: "SEED",
      fileSizeBytes: 980,
      sourceLabel: "Synthetic HR Restricted Ledger",
      sourceType: "SYNTHETIC_DEMO",
      verificationStatus: "SYNTHETIC_RECORD",
      extractionStatus: "COMPLETED",
      extractedSummary:
        "Confidential HR salary bands and shift differentials for Fremont production ramp (restricted to HR Manager, CEO, Auditor).",
      associatedInfo: "Category: WORKFORCE · HR_RESTRICTED",
      accessLevel: "HR_RESTRICTED",
      chunks: {
        create: [
          {
            companyId: tesla.id,
            departmentId: tHR.id,
            category: "WORKFORCE",
            chunkIndex: 0,
            content:
              "HR RESTRICTED RECORD: Fremont HV Battery & Body Assembly retention bonus pool of $1.85M applies strictly to shift leads and power-electronics specialists. Unauthorized departments may not inspect individual pay bands.",
            accessLevel: "HR_RESTRICTED",
          },
        ],
      },
    },
  });
  void docPublic;

  // Approval Policies
  await prisma.approvalPolicy.createMany({
    data: [
      {
        companyId: tesla.id,
        name: "Standard Operational Spend (Up to $25,000)",
        minAmount: 0,
        maxAmount: 25000,
        requiresDeptManager: true,
        requiresFinanceManager: true,
        requiresExecutiveOrBoard: false,
        isActive: true,
      },
      {
        companyId: tesla.id,
        name: "Major CapEx & Infrastructure Investment (> $25,000)",
        minAmount: 25000.01,
        maxAmount: null,
        requiresDeptManager: true,
        requiresFinanceManager: true,
        requiresExecutiveOrBoard: true,
        isActive: true,
      },
    ],
  });

  // Seeded Strategic Decision (Historical Pilot)
  const pilotDecision = await prisma.strategicDecision.create({
    data: {
      companyId: tesla.id,
      departmentId: tTech.id,
      responsibleUserId: tUsers.cto.id,
      title: "California 6-Station Supercharger Corridor Pilot",
      description:
        "Authorize initial capital allocation to build and commission 6 DC fast-charging stations connecting Los Angeles, San Francisco, and Lake Tahoe corridors.",
      objective:
        "Validate 90–120 kW charging reliability, site-host agreements, and utility interconnection timelines before national network expansion.",
      alternativesConsidered:
        "1) Rely on third-party public Level 2 chargers; 2) Immediate 100-station national commitment; 3) Controlled 6-station California proof-of-concept pilot.",
      selectedOption: "Controlled 6-Station California Pilot ($1,100,000 CapEx)",
      rationale:
        "Limits capital exposure during early Model S production ramp while proving long-distance California travel capability for earliest 85 kWh buyers.",
      assumptions:
        "Average turnkey station cost ~$165k–$183k; site-hosts waive land rent in exchange for retail foot traffic.",
      risks:
        "Utility transformer delays beyond 16 weeks; higher commercial demand tariffs in peak summer months.",
      financialImplications:
        "$1,100,000 dedicated project budget allocated under Supercharger & Powertrain Engineering.",
      estimatedCost: 1100000,
      expectedOutcome:
        "6 operational corridors supporting LA–SF–Tahoe trips with >98% charger uptime.",
      reviewDate: teslaDate(45),
      approvalStatus: "APPROVED",
      isSynthetic: true,
    },
  });

  // Budgets (linked to Departments & Decisions)
  const bSupercharger = await prisma.budget.create({
    data: {
      companyId: tesla.id,
      departmentId: tTech.id,
      decisionId: pilotDecision.id,
      name: "Supercharger CA Pilot Infrastructure",
      category: "INFRASTRUCTURE",
      fiscalPeriod: "Q4 2012 Cycle",
      allocatedAmount: 1100000,
      status: "ACTIVE",
      notes: "Linked directly to approved California 6-Station Supercharger Pilot resolution.",
      isSynthetic: true,
    },
  });
  const bFremont = await prisma.budget.create({
    data: {
      companyId: tesla.id,
      departmentId: tOps.id,
      name: "Fremont Model S Tooling & Assembly Ramp",
      category: "DEPARTMENT",
      fiscalPeriod: "Q4 2012 Cycle",
      allocatedAmount: 4200000,
      status: "ACTIVE",
      notes: "Stamping dies, battery module test benches, and assembly line QA.",
      isSynthetic: true,
    },
  });
  const bFinance = await prisma.budget.create({
    data: {
      companyId: tesla.id,
      departmentId: tFinance.id,
      name: "Treasury, Audit & Compliance Ops",
      category: "OPERATING",
      fiscalPeriod: "Q4 2012 Cycle",
      allocatedAmount: 480000,
      status: "APPROVED",
      notes: "External audit, DOE reporting, and corporate insurance.",
      isSynthetic: true,
    },
  });

  // Invoices (AR + AP)
  const invAR1 = await prisma.invoice.create({
    data: {
      companyId: tesla.id,
      departmentId: tOps.id,
      direction: "RECEIVABLE",
      invoiceNumber: "INV-TSL-AR-1041",
      counterpartyName: "Bay Area Clean Fleet Partners",
      counterpartyEmail: "ap@bayareafleet.example.com",
      description: "Model S Signature Fleet Reservation Deposit (3 Vehicles)",
      amount: 120000,
      paidAmount: 120000,
      currency: "USD",
      issueDate: teslaDate(-14),
      dueDate: teslaDate(-4),
      status: "PAID",
      isSynthetic: true,
    },
  });
  const invAR2 = await prisma.invoice.create({
    data: {
      companyId: tesla.id,
      departmentId: tTech.id,
      direction: "RECEIVABLE",
      invoiceNumber: "INV-TSL-AR-1042",
      counterpartyName: "Pacific West Mobility Group",
      counterpartyEmail: "buyer@pacificwest.example.com",
      description:
        "Model S Corporate Reservation Deposit & Telemetry Package (Collect via PayPal Sandbox)",
      amount: 12500,
      paidAmount: 0,
      currency: "USD",
      issueDate: teslaDate(-5),
      dueDate: teslaDate(4),
      status: "ISSUED",
      isSynthetic: true,
    },
  });
  const invAR3 = await prisma.invoice.create({
    data: {
      companyId: tesla.id,
      departmentId: tTech.id,
      direction: "RECEIVABLE",
      invoiceNumber: "INV-TSL-AR-1043",
      counterpartyName: "OEM Powertrain Partner — Milestone B",
      counterpartyEmail: "settlements@oem-partner.example.com",
      description: "EV Powertrain Engineering Validation Milestone #2",
      amount: 340000,
      paidAmount: 0,
      currency: "USD",
      issueDate: teslaDate(-12),
      dueDate: teslaDate(10),
      status: "ISSUED",
      isSynthetic: true,
    },
  });

  const invAP1 = await prisma.invoice.create({
    data: {
      companyId: tesla.id,
      departmentId: tTech.id,
      budgetId: bSupercharger.id,
      direction: "PAYABLE",
      invoiceNumber: "INV-TSL-AP-2088",
      counterpartyName: "Pacific Industrial Transformers LLC",
      counterpartyEmail: "sb-vendor-transformers@business.example.com",
      description: "480V Step-Down Switchgear & Rectifier Enclosures (Harris Ranch & Gilroy)",
      amount: 42000,
      paidAmount: 0,
      currency: "USD",
      issueDate: teslaDate(-6),
      dueDate: teslaDate(3),
      status: "ISSUED",
      isSynthetic: true,
    },
  });
  const invAP2 = await prisma.invoice.create({
    data: {
      companyId: tesla.id,
      departmentId: tTech.id,
      budgetId: bSupercharger.id,
      direction: "PAYABLE",
      invoiceNumber: "INV-TSL-AP-2089",
      counterpartyName: "Sierra Civil & Trenching Inc.",
      counterpartyEmail: "billing@sierracivil.example.com",
      description: "Concrete Pads, Conduit Trenching & Signage — Tejon Ranch Site",
      amount: 18500,
      paidAmount: 0,
      currency: "USD",
      issueDate: teslaDate(-8),
      dueDate: teslaDate(1),
      status: "ISSUED",
      isSynthetic: true,
    },
  });
  const invAP3 = await prisma.invoice.create({
    data: {
      companyId: tesla.id,
      departmentId: tOps.id,
      budgetId: bFremont.id,
      direction: "PAYABLE",
      invoiceNumber: "INV-TSL-AP-2090",
      counterpartyName: "Nordic Automated Stamping GmbH",
      counterpartyEmail: "ar@nordicstamping.example.com",
      description: "Aluminum Body Press Calibration & Spare Die Package",
      amount: 95000,
      paidAmount: 95000,
      currency: "USD",
      issueDate: teslaDate(-20),
      dueDate: teslaDate(-8),
      status: "PAID",
      isSynthetic: true,
    },
  });

  // Payment Requests across distinct approval states
  const prPaid = await prisma.paymentRequest.create({
    data: {
      companyId: tesla.id,
      departmentId: tOps.id,
      budgetId: bFremont.id,
      invoiceId: invAP3.id,
      requestedById: tUsers.deptHeadOps.id,
      direction: "OUTGOING",
      title: "Body Press Calibration Settlement — Nordic Stamping",
      counterpartyName: "Nordic Automated Stamping GmbH",
      counterpartyEmail: "ar@nordicstamping.example.com",
      amount: 95000,
      currency: "USD",
      category: "Manufacturing Tooling",
      purpose: "Final acceptance payment for Fremont aluminum stamping die calibration.",
      status: "PAID",
      aiValidationSummary:
        "Advisory AI check complete: Within Fremont budget; 3-tier human approvals verified.",
      aiRiskFlagsJson: "[]",
      requiresDeptApproval: true,
      requiresFinanceApproval: true,
      requiresExecApproval: true,
      dueDate: teslaDate(-8),
      executedAt: teslaDate(-8),
      provider: "PAYPAL_SIMULATED",
      providerReference: "SIM-PAYOUT-SEED-2090",
      isSimulated: true,
      isSynthetic: true,
      approvalActions: {
        create: [
          {
            actorUserId: tUsers.deptHeadOps.id,
            actorName: tUsers.deptHeadOps.name,
            actorRole: tUsers.deptHeadOps.role,
            action: "SUBMITTED",
            comment: "Tooling calibration signed off by Fremont QA.",
          },
          {
            actorUserId: tUsers.finMgr.id,
            actorName: tUsers.finMgr.name,
            actorRole: tUsers.finMgr.role,
            action: "FINANCE_APPROVED",
            comment: "Budget variance checked against Fremont ramp allocation.",
          },
          {
            actorUserId: tUsers.cfo.id,
            actorName: tUsers.cfo.name,
            actorRole: tUsers.cfo.role,
            action: "EXEC_APPROVED",
            comment: "Approved >$25k CapEx disbursement.",
          },
          {
            actorUserId: tUsers.executor.id,
            actorName: tUsers.executor.name,
            actorRole: tUsers.executor.role,
            action: "EXECUTED",
            comment: "Released via simulated treasury settlement.",
          },
        ],
      },
    },
  });

  // Pending Dept Approval (Scenario 4 start: requested by Hannah Park, Engineer)
  const prDeptPending = await prisma.paymentRequest.create({
    data: {
      companyId: tesla.id,
      departmentId: tTech.id,
      budgetId: bSupercharger.id,
      invoiceId: invAP1.id,
      requestedById: tUsers.empTech.id,
      direction: "OUTGOING",
      title: "480V Switchgear Cabinets — Harris Ranch & Gilroy",
      counterpartyName: "Pacific Industrial Transformers LLC",
      counterpartyEmail: "sb-vendor-transformers@business.example.com",
      amount: 42000,
      currency: "USD",
      category: "Supercharger Hardware",
      purpose: "Payment for delivered 480V switchgear enclosures under California Pilot.",
      status: "PENDING_DEPT_APPROVAL",
      aiValidationSummary:
        "Advisory AI check complete: Policy Major CapEx (> $25,000) requires Department Manager → Finance Manager/CFO → Executive/Board approval. Budget remaining is sufficient.",
      aiRiskFlagsJson: JSON.stringify([
        "Amount exceeds $25,000 threshold — Executive/Board human sign-off required before execution.",
      ]),
      requiresDeptApproval: true,
      requiresFinanceApproval: true,
      requiresExecApproval: true,
      dueDate: teslaDate(3),
      provider: "PAYPAL_SIMULATED",
      isSimulated: true,
      isSynthetic: true,
      approvalActions: {
        create: [
          {
            actorUserId: tUsers.empTech.id,
            actorName: tUsers.empTech.name,
            actorRole: tUsers.empTech.role,
            action: "SUBMITTED",
            comment: "Equipment inspected at Fremont staging dock.",
          },
        ],
      },
    },
  });

  // Pending Finance Approval
  const prFinancePending = await prisma.paymentRequest.create({
    data: {
      companyId: tesla.id,
      departmentId: tTech.id,
      budgetId: bSupercharger.id,
      invoiceId: invAP2.id,
      requestedById: tUsers.empTech.id,
      direction: "OUTGOING",
      title: "Tejon Ranch Civil & Concrete Pad Works",
      counterpartyName: "Sierra Civil & Trenching Inc.",
      counterpartyEmail: "billing@sierracivil.example.com",
      amount: 18500,
      currency: "USD",
      category: "Site Civil Works",
      purpose: "Completion invoice for Tejon Ranch Supercharger concrete trenching.",
      status: "PENDING_FINANCE_APPROVAL",
      aiValidationSummary:
        "Advisory AI check complete: Under $25,000 threshold (Dept + Finance required). Department approval granted.",
      aiRiskFlagsJson: "[]",
      requiresDeptApproval: true,
      requiresFinanceApproval: true,
      requiresExecApproval: false,
      dueDate: teslaDate(1),
      provider: "PAYPAL_SIMULATED",
      isSimulated: true,
      isSynthetic: true,
      approvalActions: {
        create: [
          {
            actorUserId: tUsers.empTech.id,
            actorName: tUsers.empTech.name,
            actorRole: tUsers.empTech.role,
            action: "SUBMITTED",
            comment: "Site civil inspection photos attached.",
          },
          {
            actorUserId: tUsers.deptMgrTech.id,
            actorName: tUsers.deptMgrTech.name,
            actorRole: tUsers.deptMgrTech.role,
            action: "DEPT_APPROVED",
            comment: "Verified Tejon Ranch pad installation complete.",
          },
        ],
      },
    },
  });

  // Approved Ready for Execution (for Payment Executor demonstration)
  const prReady = await prisma.paymentRequest.create({
    data: {
      companyId: tesla.id,
      departmentId: tFinance.id,
      budgetId: bFinance.id,
      requestedById: tUsers.finMgr.id,
      direction: "OUTGOING",
      title: "Q4 External Audit Retainer Installment",
      counterpartyName: "Vanguard Assurance LLP",
      counterpartyEmail: "billing@vanguard-assurance.example.com",
      amount: 14500,
      currency: "USD",
      category: "Audit & Compliance",
      purpose: "Scheduled quarterly statutory audit review retainer.",
      status: "APPROVED_READY_FOR_EXECUTION",
      aiValidationSummary:
        "Advisory AI check complete: All required human approvals granted; awaiting Payment Executor release.",
      aiRiskFlagsJson: "[]",
      requiresDeptApproval: true,
      requiresFinanceApproval: true,
      requiresExecApproval: false,
      dueDate: teslaDate(0),
      provider: "PAYPAL_SIMULATED",
      isSimulated: true,
      isSynthetic: true,
      approvalActions: {
        create: [
          {
            actorUserId: tUsers.finMgr.id,
            actorName: tUsers.finMgr.name,
            actorRole: tUsers.finMgr.role,
            action: "SUBMITTED",
            comment: "Routine audit retainer.",
          },
          {
            actorUserId: tUsers.cfo.id,
            actorName: tUsers.cfo.name,
            actorRole: tUsers.cfo.role,
            action: "FINANCE_APPROVED",
            comment: "Authorized for treasury execution.",
          },
        ],
      },
    },
  });

  // Completed Historical Transactions (matching Invoices & Budgets)
  await prisma.transaction.createMany({
    data: [
      {
        companyId: tesla.id,
        departmentId: tOps.id,
        invoiceId: invAR1.id,
        direction: "INCOMING",
        amount: 120000,
        currency: "USD",
        category: "Customer Reservations",
        description: "Bay Area Clean Fleet Partners — Model S Deposit Settlement",
        counterparty: "Bay Area Clean Fleet Partners",
        occurredAt: teslaDate(-4),
        status: "COMPLETED",
        source: "BANK_FEED_DEMO",
        externalRef: "WIRE-DEMO-1041",
        isSimulated: true,
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tOps.id,
        budgetId: bFremont.id,
        invoiceId: invAP3.id,
        paymentRequestId: prPaid.id,
        direction: "OUTGOING",
        amount: 95000,
        currency: "USD",
        category: "Manufacturing Tooling",
        description: "Body Press Calibration Settlement — Nordic Automated Stamping",
        counterparty: "Nordic Automated Stamping GmbH",
        occurredAt: teslaDate(-8),
        status: "COMPLETED",
        source: "PAYPAL_SIMULATED",
        externalRef: "SIM-PAYOUT-SEED-2090",
        isSimulated: true,
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tTech.id,
        budgetId: bSupercharger.id,
        direction: "OUTGOING",
        amount: 182000,
        currency: "USD",
        category: "Supercharger Hardware",
        description: "Hawthorne & Folsom Pilot Charger Modules — Tranche 1",
        counterparty: "Delta Power Electronics Co.",
        occurredAt: teslaDate(-12),
        status: "COMPLETED",
        source: "BANK_FEED_DEMO",
        externalRef: "ACH-DEMO-8841",
        isSimulated: true,
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tFinance.id,
        budgetId: bFinance.id,
        direction: "OUTGOING",
        amount: 24000,
        currency: "USD",
        category: "Insurance & Risk",
        description: "Product Liability & Fremont Facility Coverage",
        counterparty: "Pacific Commercial Underwriters",
        occurredAt: teslaDate(-10),
        status: "COMPLETED",
        source: "BANK_FEED_DEMO",
        externalRef: "ACH-DEMO-8810",
        isSimulated: true,
        isSynthetic: true,
      },
    ],
  });

  // Financial Calendar Events (connected directly to invoices, requests & forecasts)
  await prisma.calendarEvent.createMany({
    data: [
      {
        companyId: tesla.id,
        departmentId: tOps.id,
        budgetId: bFremont.id,
        invoiceId: invAP3.id,
        paymentRequestId: prPaid.id,
        title: "Nordic Stamping Die Calibration",
        description: "Completed manufacturing tooling settlement.",
        eventDate: teslaDate(-8),
        amount: 95000,
        direction: "OUTGOING",
        category: "Manufacturing Tooling",
        status: "PAID",
        sourceLabel: "Payment Request + Invoice INV-TSL-AP-2090",
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tOps.id,
        invoiceId: invAR1.id,
        title: "Bay Area Fleet Deposit Collected",
        description: "Incoming deposit for 3 Signature Model S reservations.",
        eventDate: teslaDate(-4),
        amount: 120000,
        direction: "INCOMING",
        category: "Customer Reservations",
        status: "PAID",
        sourceLabel: "Invoice INV-TSL-AR-1041",
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tFinance.id,
        budgetId: bFinance.id,
        paymentRequestId: prReady.id,
        title: "Vanguard Assurance Audit Retainer",
        description: "Approved by Finance; ready for Payment Executor release.",
        eventDate: teslaDate(0),
        amount: 14500,
        direction: "OUTGOING",
        category: "Audit & Compliance",
        status: "APPROVED",
        sourceLabel: "Payment Request (Approved)",
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tTech.id,
        budgetId: bSupercharger.id,
        invoiceId: invAP2.id,
        paymentRequestId: prFinancePending.id,
        title: "Sierra Civil — Tejon Ranch Concrete Pad",
        description: "Due invoice awaiting Finance Manager review.",
        eventDate: teslaDate(1),
        amount: 18500,
        direction: "OUTGOING",
        category: "Site Civil Works",
        status: "DUE",
        sourceLabel: "Invoice INV-TSL-AP-2089",
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tTech.id,
        budgetId: bSupercharger.id,
        invoiceId: invAP1.id,
        paymentRequestId: prDeptPending.id,
        title: "Pacific Industrial 480V Switchgear",
        description: "Awaiting Dept → Finance → Exec approval chain.",
        eventDate: teslaDate(3),
        amount: 42000,
        direction: "OUTGOING",
        category: "Supercharger Hardware",
        status: "DUE",
        sourceLabel: "Invoice INV-TSL-AP-2088",
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tTech.id,
        invoiceId: invAR2.id,
        title: "Pacific West Mobility Reservation Receivable",
        description: "Open receivable eligible for PayPal Sandbox Checkout collection.",
        eventDate: teslaDate(4),
        amount: 12500,
        direction: "INCOMING",
        category: "Customer Reservations",
        status: "CONTRACTED",
        sourceLabel: "Invoice INV-TSL-AR-1042",
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tTech.id,
        invoiceId: invAR3.id,
        title: "OEM Powertrain Milestone B Receivable",
        description: "Contracted engineering milestone payment due from OEM partner.",
        eventDate: teslaDate(10),
        amount: 340000,
        direction: "INCOMING",
        category: "OEM Powertrain",
        status: "CONTRACTED",
        sourceLabel: "Invoice INV-TSL-AR-1043",
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tOps.id,
        budgetId: bFremont.id,
        title: "Projected Q+1 Fremont Battery Cell Batch",
        description: "AI expenditure projection based on Model S weekly build ramp.",
        eventDate: teslaDate(15),
        amount: 310000,
        direction: "OUTGOING",
        category: "Battery Supply Forecast",
        status: "FORECASTED",
        sourceLabel: "AI Operational Ramp Projection",
        isSynthetic: true,
      },
      {
        companyId: tesla.id,
        departmentId: tTech.id,
        budgetId: bSupercharger.id,
        decisionId: pilotDecision.id,
        title: "Proposed Phase 2 Corridor Permitting Deposit",
        description: "Proposed spending item contingent on board corridor decision.",
        eventDate: teslaDate(21),
        amount: 125000,
        direction: "OUTGOING",
        category: "Infrastructure Proposal",
        status: "PROPOSED",
        sourceLabel: "Board Corridor Proposal",
        isSynthetic: true,
      },
    ],
  });

  // Seeded Boardroom Meeting with Scenario 1 Disagreement
  const meeting1 = await prisma.meeting.create({
    data: {
      companyId: tesla.id,
      title: "Q4 Strategic Boardroom: Supercharger Expansion vs. Liquidity & Grid Capacity",
      meetingType: "Board Strategy Session",
      scheduledAt: teslaDate(0, 14),
      status: "IN_PROGRESS",
      agenda:
        "1. Review Model S Fremont ramp gross margin trajectory\n2. Debate aggressive 2013–2022 Supercharger corridor expansion vs. cash preservation\n3. Evaluate engineering/utility grid interconnection bottlenecks\n4. Vote on milestone-gated Phase 1 infrastructure authorization",
      participantsJson: JSON.stringify([
        { name: tUsers.ceo.name, role: "CEO" },
        { name: tUsers.cfo.name, role: "CFO" },
        { name: tUsers.cto.name, role: "CTO" },
        { name: tUsers.board.name, role: "BOARD_MEMBER" },
      ]),
      contextSummary:
        "Following the Sept 24, 2012 Supercharger unveiling and Oct 2012 follow-on capital raise, leadership is divided on the pace and capital commitment for scaling fast-charging infrastructure.",
      transcript:
        "CEO: We should aggressively expand Supercharger corridors into 15 new regional markets immediately to eliminate range anxiety and accelerate Model S demand.\nCFO: Our Q3 filings showed negative automotive gross margin during the ramp; our financial position cannot support un-gated capital burn without risking liquidity covenants.\nCTO: Our current power electronics engineering bandwidth and 16-to-24-week utility transformer lead times cannot handle an unrestricted multi-region rollout simultaneously.",
      aiSummary:
        "Active three-way strategic disagreement between commercial growth urgency (CEO), liquidity conservation (CFO), and engineering/utility bottlenecks (CTO).",
      actionItemsJson: JSON.stringify([
        "Investigate milestone-gated Phase 1 CapEx options",
        "Run 10-year Supercharger capacity & cost range scenario",
      ]),
      isSynthetic: true,
    },
  });

  await prisma.boardroomMessage.createMany({
    data: [
      {
        companyId: tesla.id,
        meetingId: meeting1.id,
        authorUserId: tUsers.ceo.id,
        speakerName: "Marcus Sterling (CEO)",
        speakerRole: "CEO",
        messageType: "PARTICIPANT",
        content:
          "We should aggressively expand Supercharger corridors into new regional markets immediately so Model S buyers see true interstate freedom.",
      },
      {
        companyId: tesla.id,
        meetingId: meeting1.id,
        authorUserId: tUsers.cfo.id,
        speakerName: "Deepak Kulkarni (CFO)",
        speakerRole: "CFO",
        messageType: "PARTICIPANT",
        content:
          "Our financial position cannot support aggressive un-gated expansion while Fremont Model S gross margins remain negative and cash must buffer the production ramp.",
      },
      {
        companyId: tesla.id,
        meetingId: meeting1.id,
        authorUserId: tUsers.cto.id,
        speakerName: "J.B. Carter (CTO)",
        speakerRole: "CTO",
        messageType: "PARTICIPANT",
        content:
          "Our current engineering team and utility grid interconnection capacity cannot handle simultaneous multi-region deployment without jeopardizing Model S power-electronics delivery.",
      },
    ],
  });

  // Seeded 10-year Supercharger Strategic Scenario
  await prisma.strategicScenario.create({
    data: {
      companyId: tesla.id,
      decisionId: pilotDecision.id,
      title: "10-Year US & Regional Supercharger Network Rollout",
      horizonYears: 10,
      questionContext:
        "Evaluates 10-year station capacity, CapEx, OpEx, and workforce needs under Optimistic, Baseline, and Adverse assumptions (2012 unit cost basis).",
      baseParametersJson: JSON.stringify({
        title: "10-Year US & Regional Supercharger Network Rollout",
        horizonYears: 10,
        targetUnits: 250,
        unitLabel: "Supercharger Stations (6 Stalls)",
        unitCapex: 165000,
        annualOpexPerUnit: 18500,
        annualRevenuePerUnit: 0,
        startingCashReserve: 24850000,
        workforcePerTenUnits: 1.5,
        capexLeadMonths: 4,
      }),
      optimisticJson: JSON.stringify({}),
      baselineJson: JSON.stringify({}),
      adverseJson: JSON.stringify({}),
      methodologyNotes:
        "Computed dynamically via deterministic range model using synthetic 2012 station BOM ($165k CapEx, $18.5k/yr OpEx). Probabilities intentionally omitted.",
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: tesla.id,
      actorUserId: tUsers.admin.id,
      actorName: tUsers.admin.name,
      actorRole: "ADMINISTRATOR",
      action: "WORKSPACE_SEEDED",
      entityType: "Company",
      entityId: tesla.id,
      detailsJson: JSON.stringify({
        historicalCutoffDate: "2012-12-31",
        syntheticRecordsSeeded: true,
      }),
      authorized: true,
    },
  });

  // =========================================================================
  // COMPANY 2: MERIDIAN MOBILITY LABS (FICTIONAL MULTI-TENANT WORKSPACE)
  // =========================================================================
  const meridian = await prisma.company.create({
    data: {
      slug: "meridian-mobility",
      name: "Meridian Mobility Labs",
      industry: "B2B Commercial Fleet Telemetry & Depot Charging SaaS",
      businessModel:
        "Recurring fleet SaaS subscriptions plus turnkey depot charger hardware & energy load-management contracts.",
      description:
        "Fictional Series B B2B commercial fleet electrification platform demonstrating Stratium's company-independent multi-tenant architecture, strict workspace isolation, and recurring SaaS/hardware finance tracking.",
      operatingRegions: "North America (Chicago, Austin), UK (London), India (Bengaluru)",
      companySize: "185 employees",
      strategicObjectives:
        "1) Expand depot charging telemetry into 3 new logistics corridors; 2) Maintain >72% SaaS gross margin while funding hardware working capital; 3) Reduce DSO on commercial fleet invoices below 30 days.",
      productsAndServices:
        "Meridian GridOS (fleet charge scheduling SaaS), DepotNode 150kW Commercial Chargers, Fleet Health API.",
      customerSegments:
        "Last-mile delivery fleets, municipal transit depots, cold-chain logistics operators.",
      competitorsSummary:
        "ChargePoint Fleet, EVBox Commercial, bespoke utility managed-charging programs.",
      historicalCutoffDate: null,
      isHistoricalDemo: false,
      syntheticDataNotice:
        "Fully fictional demonstration company workspace isolated from Tesla historical simulation.",
      currency: "USD",
      recordedCashBalance: 6420000,
      recordedBalanceSource: "Meridian Treasury Operating Account (Demo Seed)",
    },
  });

  const mExec = await prisma.department.create({
    data: {
      companyId: meridian.id,
      name: "Executive",
      code: "EXEC",
      headTitle: "CEO",
      description: "Executive governance and corporate development.",
    },
  });
  const mFin = await prisma.department.create({
    data: {
      companyId: meridian.id,
      name: "Finance",
      code: "FIN",
      parentDepartmentId: mExec.id,
      headTitle: "CFO",
      description: "FP&A, treasury, invoicing, and compliance.",
    },
  });
  const mEng = await prisma.department.create({
    data: {
      companyId: meridian.id,
      name: "GridOS Engineering",
      code: "ENG",
      parentDepartmentId: mExec.id,
      headTitle: "CTO",
      description: "Cloud telemetry, OCPP charger firmware, and AI load balancing.",
    },
  });

  const mCeo = await prisma.user.create({
    data: {
      companyId: meridian.id,
      departmentId: mExec.id,
      name: "Elena Rostova (Demo CEO)",
      email: "ceo@meridian-demo.local",
      title: "Chief Executive Officer",
      role: "CEO",
      employmentType: "EXECUTIVE",
      monthlySalary: 14500,
      payCycle: "MONTHLY",
      payDayOfMonth: 28,
      payoutEmail: "ceo@meridian-demo.local",
      payrollStatus: "ACTIVE",
    },
  });
  const mCfo = await prisma.user.create({
    data: {
      companyId: meridian.id,
      departmentId: mFin.id,
      name: "Victor Alverez (Demo CFO)",
      email: "cfo@meridian-demo.local",
      title: "Chief Financial Officer",
      role: "CFO",
      employmentType: "EXECUTIVE",
      monthlySalary: 13200,
      payCycle: "MONTHLY",
      payDayOfMonth: 28,
      payoutEmail: "cfo@meridian-demo.local",
      payrollStatus: "ACTIVE",
    },
  });
  const mFinMgr = await prisma.user.create({
    data: {
      companyId: meridian.id,
      departmentId: mFin.id,
      name: "Priya Nair (Demo Finance Mgr)",
      email: "finmgr@meridian-demo.local",
      title: "Finance Controller",
      role: "FINANCE_MANAGER",
      employmentType: "FULL_TIME",
      monthlySalary: 9200,
      payCycle: "MONTHLY",
      payDayOfMonth: 28,
      payoutEmail: "finmgr@meridian-demo.local",
      payrollStatus: "ACTIVE",
    },
  });
  await prisma.user.create({
    data: {
      companyId: meridian.id,
      departmentId: mEng.id,
      name: "Liam O'Connor (Demo CTO)",
      email: "cto@meridian-demo.local",
      title: "Chief Technology Officer",
      role: "CTO",
      employmentType: "EXECUTIVE",
      monthlySalary: 13200,
      payCycle: "MONTHLY",
      payDayOfMonth: 28,
      payoutEmail: "cto@meridian-demo.local",
      payrollStatus: "ACTIVE",
    },
  });

  await prisma.companyProfileSection.createMany({
    data: [
      {
        companyId: meridian.id,
        category: "STRATEGY",
        title: "European & India Commercial Depot Expansion Strategy",
        summary: "Target 45 multi-bay commercial fleet hubs across UK and India logistics corridors.",
        content:
          "Meridian combines GridOS annual SaaS contracts ($52k/hub annual recurring revenue) with modular 150 kW depot hardware ($95k CapEx per hub). Series B runway stands at $6.42M recorded cash with $285k monthly net burn.",
        sourceType: "SYNTHETIC_DEMO",
        sourceCitation: "Meridian Series B Board Deck",
        verificationStatus: "SYNTHETIC_RECORD",
        effectiveDate: "2026-10-15",
        accessLevel: "COMPANY_WIDE",
      },
      {
        companyId: meridian.id,
        category: "FINANCIALS",
        title: "Unit Economics & Working Capital Profile",
        summary: "74% SaaS gross margin; hardware inventory ties up 60 days working capital.",
        content:
          "Software subscriptions generate predictable gross margins, whereas hardware procurement requires 40% supplier prepayment prior to customer commissioning.",
        sourceType: "SYNTHETIC_DEMO",
        sourceCitation: "Meridian Q3 Management Accounts",
        verificationStatus: "SYNTHETIC_RECORD",
        effectiveDate: "2026-10-30",
        accessLevel: "COMPANY_WIDE",
      },
    ],
  });

  await prisma.approvalPolicy.create({
    data: {
      companyId: meridian.id,
      name: "Meridian Standard Approval Policy",
      minAmount: 0,
      maxAmount: null,
      requiresDeptManager: true,
      requiresFinanceManager: true,
      requiresExecutiveOrBoard: false,
      isActive: true,
    },
  });

  const mBudget = await prisma.budget.create({
    data: {
      companyId: meridian.id,
      departmentId: mEng.id,
      name: "GridOS Cloud & Telemetry Infrastructure",
      category: "DEPARTMENT",
      fiscalPeriod: "Active Quarter",
      allocatedAmount: 650000,
      status: "ACTIVE",
      isSynthetic: true,
    },
  });

  const mInvAR = await prisma.invoice.create({
    data: {
      companyId: meridian.id,
      departmentId: mFin.id,
      direction: "RECEIVABLE",
      invoiceNumber: "INV-MRD-AR-401",
      counterpartyName: "NorthStar Cold-Chain Logistics",
      counterpartyEmail: "ap@northstarlogistics.example.com",
      description: "GridOS Annual Depot Subscription (12 Fleet Bays)",
      amount: 36000,
      paidAmount: 0,
      currency: "USD",
      issueDate: relativeDate(-3),
      dueDate: relativeDate(12),
      status: "ISSUED",
      isSynthetic: true,
    },
  });

  await prisma.transaction.create({
    data: {
      companyId: meridian.id,
      departmentId: mEng.id,
      budgetId: mBudget.id,
      direction: "OUTGOING",
      amount: 78000,
      currency: "USD",
      category: "Cloud Infrastructure",
      description: "Quarterly Telemetry Compute & IoT Gateway Hosting",
      counterparty: "CloudCore Infrastructure",
      occurredAt: relativeDate(-5),
      status: "COMPLETED",
      source: "BANK_FEED_DEMO",
      externalRef: "ACH-MRD-4001",
      isSimulated: true,
      isSynthetic: true,
    },
  });

  await prisma.calendarEvent.createMany({
    data: [
      {
        companyId: meridian.id,
        departmentId: mFin.id,
        invoiceId: mInvAR.id,
        title: "NorthStar Logistics Annual Renewal",
        description: "Collect GridOS fleet SaaS invoice via PayPal Sandbox.",
        eventDate: relativeDate(12),
        amount: 36000,
        direction: "INCOMING",
        category: "SaaS Subscription",
        status: "CONTRACTED",
        sourceLabel: "Invoice INV-MRD-AR-401",
        isSynthetic: true,
      },
      {
        companyId: meridian.id,
        departmentId: mEng.id,
        budgetId: mBudget.id,
        title: "CloudCore Compute Settlement",
        description: "Completed quarterly telemetry infrastructure billing.",
        eventDate: relativeDate(-5),
        amount: 78000,
        direction: "OUTGOING",
        category: "Cloud Infrastructure",
        status: "PAID",
        sourceLabel: "Bank Feed Transaction",
        isSynthetic: true,
      },
    ],
  });

  const mMeeting = await prisma.meeting.create({
    data: {
      companyId: meridian.id,
      title: "UK & India Depot Hub Rollout Review",
      meetingType: "Executive Committee",
      scheduledAt: relativeDate(1, 11),
      status: "SCHEDULED",
      agenda: "Evaluate working capital exposure for 45 commercial fleet depots.",
      participantsJson: JSON.stringify([
        { name: mCeo.name, role: "CEO" },
        { name: mCfo.name, role: "CFO" },
        { name: mFinMgr.name, role: "FINANCE_MANAGER" },
      ]),
      contextSummary: "Series B regional expansion alignment.",
      isSynthetic: true,
    },
  });
  void mMeeting;

  console.log("Stratium seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
