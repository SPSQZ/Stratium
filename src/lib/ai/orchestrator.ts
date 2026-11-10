import { type SessionContext } from "@/lib/auth/rbac";
import {
  formatCurrency,
  type StructuredBoardroomResponse,
} from "@/lib/types";
import {
  toolCalculateFinancialScenario,
  toolQueryFinancialRecords,
  toolRetrieveCompanyIntelligence,
  toolRetrieveHistoricalDecisions,
  toolSearchPublicBenchmarks,
} from "@/lib/ai/tools";

export interface BoardroomOrchestrationInput {
  session: SessionContext;
  meetingTitle: string;
  meetingContext: string;
  prompt: string;
  speakerName?: string;
  speakerRole?: string;
  recentTranscript?: Array<{ speaker: string; role: string; text: string }>;
}

const TOOL_DECLARATIONS = [
  {
    name: "retrieve_company_intelligence",
    description:
      "Retrieve RBAC-filtered company profile sections and uploaded document chunks with source citations and verification status.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        categories: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["query"],
    },
  },
  {
    name: "query_financial_records",
    description:
      "Query live corporate financial records: recorded cash balance, incoming/outgoing transactions, AR/AP invoices, department budgets, and pending approvals.",
    parameters: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["SUMMARY", "BUDGETS", "INVOICES", "TRANSACTIONS", "ALL"],
        },
      },
    },
  },
  {
    name: "retrieve_historical_decisions",
    description:
      "Retrieve past strategic decisions, board resolutions, rationale, risks, and linked budgets from decision memory.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
    },
  },
  {
    name: "calculate_financial_scenario",
    description:
      "Run deterministic 3-scenario (Optimistic, Baseline, Adverse) financial and deployment capacity calculations. Use this instead of mental arithmetic.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        horizonYears: { type: "number" },
        targetUnits: { type: "number" },
        unitLabel: { type: "string" },
        unitCapex: { type: "number" },
        annualOpexPerUnit: { type: "number" },
        annualRevenuePerUnit: { type: "number" },
        workforcePerTenUnits: { type: "number" },
      },
    },
  },
  {
    name: "search_public_benchmarks",
    description:
      "Check verified public historical benchmarks while strictly enforcing any company historical cutoff date (e.g., Dec 2012 for Tesla historical simulation).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
];

async function executeNamedTool(
  session: SessionContext,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "retrieve_company_intelligence":
      return toolRetrieveCompanyIntelligence(session, {
        query: String(args.query ?? ""),
        categories: Array.isArray(args.categories)
          ? args.categories.map(String)
          : undefined,
      });
    case "query_financial_records":
      return toolQueryFinancialRecords(session, {
        scope: (args.scope as "ALL" | undefined) ?? "ALL",
      });
    case "retrieve_historical_decisions":
      return toolRetrieveHistoricalDecisions(session, {
        query: args.query ? String(args.query) : undefined,
      });
    case "calculate_financial_scenario":
      return toolCalculateFinancialScenario(session, {
        title: args.title ? String(args.title) : undefined,
        horizonYears:
          typeof args.horizonYears === "number" ? args.horizonYears : undefined,
        targetUnits:
          typeof args.targetUnits === "number" ? args.targetUnits : undefined,
        unitLabel: args.unitLabel ? String(args.unitLabel) : undefined,
        unitCapex: typeof args.unitCapex === "number" ? args.unitCapex : undefined,
        annualOpexPerUnit:
          typeof args.annualOpexPerUnit === "number"
            ? args.annualOpexPerUnit
            : undefined,
        annualRevenuePerUnit:
          typeof args.annualRevenuePerUnit === "number"
            ? args.annualRevenuePerUnit
            : undefined,
        workforcePerTenUnits:
          typeof args.workforcePerTenUnits === "number"
            ? args.workforcePerTenUnits
            : undefined,
      });
    case "search_public_benchmarks":
      return toolSearchPublicBenchmarks(session, {
        query: String(args.query ?? ""),
      });
    default:
      return { error: `Unknown tool ${name}` };
  }
}

function buildSystemPrompt(session: SessionContext, meetingTitle: string, meetingContext: string): string {
  const cutoffRule = session.company.historicalCutoffDate
    ? `CRITICAL HISTORICAL SIMULATION RULE: Today's simulated present date in this boardroom is ${session.company.historicalCutoffDate}. Reason and speak strictly from the vantage point of ${session.company.historicalCutoffDate}—events up to this date are recent developments, while dates after ${session.company.historicalCutoffDate} are the uncertain future and have NOT occurred yet. Do NOT cite, hint at, or rely on any real-world post-cutoff outcomes, products, stock prices, or financials. If asked directly about post-cutoff events, explicitly state they lie beyond the simulation cutoff.`
    : "";

  return `You are Stratium, a disciplined corporate AI Strategic Boardroom Assistant for ${session.company.name} (${session.company.currency}).
Active meeting: "${meetingTitle}". Context: ${meetingContext}.
Active user: ${session.user.name} (${session.user.role}, department: ${session.user.departmentName ?? "Executive"}).
${cutoffRule}

BEHAVIOR RULES:
1. Always call relevant tools before answering (call multiple tools in parallel when needed). Never guess numbers or fabricate transactions.
2. Distinguish VERIFIED_PUBLIC facts, SYNTHETIC_RECORD internal demo records, MANAGEMENT_ASSUMPTION claims, and AI_HYPOTHESIS proposals.
3. Never automatically agree with the CEO or highest-ranking participant. Fairly evaluate conflicting viewpoints across Finance, Product, Technology, Operations, Workforce, and Risk.
4. Use calculate_financial_scenario for multi-year projections or capacity modeling; never invent probability percentages.
5. Never claim authority to approve or execute payments.

Respond strictly with valid JSON matching this TypeScript interface:
{
  "directAnswer": string,
  "conflictAnalysis": {
    "hasConflict": boolean,
    "underlyingConflict": string,
    "perspectives": [{"roleOrSpeaker": string, "position": string, "evidenceCheck": string, "unsupportedAssumptions": string[]}],
    "balancedAssessment": string,
    "recommendedAlternatives": string[]
  } | null,
  "supportingEvidence": [{"claim": string, "source": string, "verificationBadge": "VERIFIED_PUBLIC"|"SYNTHETIC_RECORD"|"USER_PROVIDED_UNVERIFIED"|"MANAGEMENT_ASSUMPTION"|"AI_HYPOTHESIS"}],
  "counterargument": string,
  "financialImpact": string,
  "operationalImpact": string,
  "risks": string[],
  "uncertaintiesAndMissingData": string[],
  "suggestedNextQuestions": string[],
  "suggestedScenarioParams": {"title": string, "horizonYears": number, "targetUnits": number, "unitCapex": number, "annualOpexPerUnit": number, "annualRevenuePerUnit": number, "workingCapitalReserve": number} | null,
  "suggestedDecisionDraft": {"title": string, "objective": string, "selectedOption": string, "alternativesConsidered": string, "rationale": string, "assumptions": string, "risks": string, "financialImplications": string, "estimatedCost": number} | null
}`;
}

function extractJsonFromText(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeStructuredResponse(
  raw: Record<string, unknown>,
  meta: {
    mode: "LLM_TOOL_ORCHESTRATED" | "DETERMINISTIC_TOOL_ENGINE";
    modelLabel: string;
    historicalCutoffApplied: string | null;
    toolTrace: Array<{ tool: string; summary: string }>;
  }
): StructuredBoardroomResponse {
  const conflictRaw = raw.conflictAnalysis as
    | StructuredBoardroomResponse["conflictAnalysis"]
    | null
    | undefined;
  return {
    mode: meta.mode,
    modelLabel: meta.modelLabel,
    historicalCutoffApplied: meta.historicalCutoffApplied,
    directAnswer: String(raw.directAnswer ?? "Analysis completed."),
    conflictAnalysis:
      conflictRaw && conflictRaw.hasConflict
        ? {
            hasConflict: true,
            underlyingConflict: String(conflictRaw.underlyingConflict ?? ""),
            perspectives: Array.isArray(conflictRaw.perspectives)
              ? conflictRaw.perspectives
              : [],
            balancedAssessment: String(conflictRaw.balancedAssessment ?? ""),
            recommendedAlternatives: Array.isArray(
              conflictRaw.recommendedAlternatives
            )
              ? conflictRaw.recommendedAlternatives.map(String)
              : [],
          }
        : undefined,
    supportingEvidence: Array.isArray(raw.supportingEvidence)
      ? (raw.supportingEvidence as StructuredBoardroomResponse["supportingEvidence"])
      : [],
    counterargument: String(
      raw.counterargument ?? "No counterargument provided."
    ),
    financialImpact: String(raw.financialImpact ?? ""),
    operationalImpact: String(raw.operationalImpact ?? ""),
    risks: Array.isArray(raw.risks) ? raw.risks.map(String) : [],
    uncertaintiesAndMissingData: Array.isArray(raw.uncertaintiesAndMissingData)
      ? raw.uncertaintiesAndMissingData.map(String)
      : [],
    suggestedNextQuestions: Array.isArray(raw.suggestedNextQuestions)
      ? raw.suggestedNextQuestions.map(String)
      : [],
    toolTrace: meta.toolTrace,
    suggestedScenarioParams:
      (raw.suggestedScenarioParams as StructuredBoardroomResponse["suggestedScenarioParams"]) ??
      undefined,
    suggestedDecisionDraft:
      (raw.suggestedDecisionDraft as StructuredBoardroomResponse["suggestedDecisionDraft"]) ??
      undefined,
  };
}

interface GeminiAttemptResult {
  response: StructuredBoardroomResponse | null;
  fallbackReason?: string;
}

const GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
];

async function fetchGeminiWithTimeout(
  endpoint: string,
  bodyPayload: Record<string, unknown>,
  timeoutMs = 35000
): Promise<Response> {
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(bodyPayload),
  });
}

async function runGeminiOrchestration(
  input: BoardroomOrchestrationInput
): Promise<GeminiAttemptResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { response: null, fallbackReason: "GEMINI_API_KEY not configured" };
  }

  const configuredModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const buildEndpoint = (m: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      m
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const systemInstruction = {
    parts: [
      {
        text: buildSystemPrompt(
          input.session,
          input.meetingTitle,
          input.meetingContext
        ),
      },
    ],
  };

  const historyText =
    input.recentTranscript && input.recentTranscript.length > 0
      ? `Recent meeting discussion:\n${input.recentTranscript
          .slice(-8)
          .map((m) => `[${m.speaker} (${m.role})]: ${m.text}`)
          .join("\n")}\n\n`
      : "";

  const initialPromptText = `${historyText}[${input.speakerName ?? input.session.user.name} (${
    input.speakerRole ?? input.session.user.role
  })]: ${input.prompt}`;

  const executeWithModel = async (
    model: string
  ): Promise<GeminiAttemptResult & { retryable?: boolean }> => {
    const contents: Array<Record<string, unknown>> = [
      {
        role: "user",
        parts: [{ text: initialPromptText }],
      },
    ];
    const toolTrace: Array<{ tool: string; summary: string }> = [];

    for (let step = 0; step < 6; step++) {
      const isFinalSynthesisStep = step === 5;
      // Gemini v1beta does not allow responseMimeType: "application/json" alongside functionDeclarations
      const bodyPayload: Record<string, unknown> = {
        systemInstruction,
        contents,
      };
      if (isFinalSynthesisStep) {
        bodyPayload.generationConfig = { responseMimeType: "application/json" };
      } else {
        bodyPayload.tools = [{ functionDeclarations: TOOL_DECLARATIONS }];
      }

      let res: Response | null = null;
      try {
        res = await fetchGeminiWithTimeout(buildEndpoint(model), bodyPayload);
      } catch {
        res = null;
      }

      if (res && (res.status === 503 || res.status === 429)) {
        await new Promise((r) => setTimeout(r, 700));
        try {
          res = await fetchGeminiWithTimeout(buildEndpoint(model), bodyPayload);
        } catch {
          res = null;
        }
      }

      if (!res) {
        return {
          response: null,
          fallbackReason: `Gemini request timed out (${model})`,
          retryable: true,
        };
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`Gemini API returned HTTP ${res.status}: ${errText.slice(0, 180)}`);
        return {
          response: null,
          fallbackReason: `Gemini HTTP ${res.status} (${model})`,
          retryable: [404, 429, 500, 503].includes(res.status),
        };
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              thought?: boolean;
              text?: string;
              functionCall?: { name: string; args?: Record<string, unknown> };
            }>;
          };
        }>;
      };

      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const fnCalls = parts.filter((p) => p.functionCall);

      if (fnCalls.length > 0 && !isFinalSynthesisStep) {
        contents.push({ role: "model", parts });
        const responseParts: Array<Record<string, unknown>> = [];
        for (const part of fnCalls) {
          const fc = part.functionCall!;
          const args = fc.args ?? {};
          const result = await executeNamedTool(input.session, fc.name, args);
          toolTrace.push({
            tool: fc.name,
            summary: `Executed with args ${JSON.stringify(args)}`,
          });
          responseParts.push({
            functionResponse: {
              name: fc.name,
              response: { output: result },
            },
          });
        }
        contents.push({ role: "user", parts: responseParts });
        continue;
      }

      // Filter out thinking parts (thought: true) so we always read the final answer
      const answerTexts = parts
        .filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text as string);
      const textPart = answerTexts.join("\n").trim();

      if (textPart) {
        const parsed = extractJsonFromText(textPart);
        if (parsed) {
          return {
            response: normalizeStructuredResponse(parsed, {
              mode: "LLM_TOOL_ORCHESTRATED",
              modelLabel: model,
              historicalCutoffApplied: input.session.company.historicalCutoffDate,
              toolTrace,
            }),
          };
        }

        // If model replied in prose after tool calls, request a strict JSON formatting pass without tools
        contents.push({ role: "model", parts: [{ text: textPart }] });
        contents.push({
          role: "user",
          parts: [
            {
              text: "Convert your complete analysis above strictly into the required JSON object schema.",
            },
          ],
        });
        try {
          const jsonPass = await fetchGeminiWithTimeout(buildEndpoint(model), {
            systemInstruction,
            contents,
            generationConfig: { responseMimeType: "application/json" },
          });
          if (jsonPass.ok) {
            const jsonPassData = (await jsonPass.json()) as {
              candidates?: Array<{
                content?: {
                  parts?: Array<{ thought?: boolean; text?: string }>;
                };
              }>;
            };
            const formattedText = (
              jsonPassData.candidates?.[0]?.content?.parts ?? []
            )
              .filter((p) => !p.thought && typeof p.text === "string")
              .map((p) => p.text as string)
              .join("\n")
              .trim();
            const formattedObj = extractJsonFromText(formattedText);
            if (formattedObj) {
              return {
                response: normalizeStructuredResponse(formattedObj, {
                  mode: "LLM_TOOL_ORCHESTRATED",
                  modelLabel: model,
                  historicalCutoffApplied:
                    input.session.company.historicalCutoffDate,
                  toolTrace,
                }),
              };
            }
          }
        } catch {
          return {
            response: null,
            fallbackReason: `Gemini JSON pass timed out (${model})`,
            retryable: true,
          };
        }
        return {
          response: null,
          fallbackReason: `Gemini response did not match JSON schema (${model})`,
          retryable: true,
        };
      }
    }

    return {
      response: null,
      fallbackReason: `Gemini exceeded tool-calling step budget (${model})`,
      retryable: true,
    };
  };

  const candidates = [
    configuredModel,
    ...GEMINI_FALLBACK_MODELS.filter((m) => m !== configuredModel),
  ].slice(0, 3);

  let lastResult: GeminiAttemptResult = {
    response: null,
    fallbackReason: "Gemini unavailable",
  };
  for (const candidate of candidates) {
    const attempt = await executeWithModel(candidate);
    if (attempt.response) {
      return { response: attempt.response };
    }
    lastResult = { response: null, fallbackReason: attempt.fallbackReason };
    if (!attempt.retryable) break;
  }
  return lastResult;
}

function detectConflictingSpeakers(
  prompt: string,
  recentTranscript?: Array<{ speaker: string; role: string; text: string }>
): Array<{ speaker: string; role: string; claim: string }> {
  const combined = [
    ...(recentTranscript?.slice(-6).map((t) => `${t.speaker} (${t.role}): ${t.text}`) ??
      []),
    prompt,
  ].join("\n");

  const lines = combined
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const speakers: Array<{ speaker: string; role: string; claim: string }> = [];
  for (const line of lines) {
    const m = line.match(
      /^(\[)?(CEO|CFO|CTO|Board Member|VP Operations|Finance Manager|COO)[^:\]]*(\])?:\s*(.+)$/i
    );
    if (m) {
      speakers.push({
        speaker: m[2].toUpperCase(),
        role: m[2].toUpperCase(),
        claim: m[4],
      });
    }
  }
  return speakers;
}

function extractHorizonAndUnits(prompt: string, isTesla: boolean): {
  horizonYears: number;
  targetUnits: number;
  unitLabel: string;
  unitCapex: number;
  annualOpexPerUnit: number;
  annualRevenuePerUnit: number;
} {
  const yrMatch = prompt.match(/(\d+)\s*-?\s*year/i);
  const horizonYears = yrMatch
    ? Math.max(1, Math.min(15, Number.parseInt(yrMatch[1], 10)))
    : 10;

  const unitMatch = prompt.match(/(\d+)\s+(?:new\s+)?(stations|hubs|regions|sites|chargers|cities)/i);

  if (isTesla) {
    const isChargingQuestion =
      /charg|supercharger|station|corridor|infrastructure/i.test(prompt);
    return {
      horizonYears,
      targetUnits: unitMatch
        ? Number.parseInt(unitMatch[1], 10)
        : isChargingQuestion
        ? 250
        : 120,
      unitLabel: isChargingQuestion
        ? "Supercharger Stations (4–8 Stalls)"
        : "Expansion Sites",
      unitCapex: isChargingQuestion ? 165000 : 250000,
      annualOpexPerUnit: isChargingQuestion ? 18500 : 32000,
      annualRevenuePerUnit: 0, // Free lifetime charging for Model S 85 kWh per Sept 2012 announcement; indirect vehicle demand driver
    };
  }

  return {
    horizonYears,
    targetUnits: unitMatch ? Number.parseInt(unitMatch[1], 10) : 45,
    unitLabel: "Regional Fleet Charging Hubs",
    unitCapex: 95000,
    annualOpexPerUnit: 14000,
    annualRevenuePerUnit: 52000,
  };
}

async function runDeterministicToolOrchestration(
  input: BoardroomOrchestrationInput
): Promise<StructuredBoardroomResponse> {
  const { session, prompt, recentTranscript } = input;
  const toolTrace: Array<{ tool: string; summary: string }> = [];
  const lower = prompt.toLowerCase();
  const isTesla = session.company.slug.includes("tesla");

  const [intel, fin, decisions, publicBench] = await Promise.all([
    toolRetrieveCompanyIntelligence(session, { query: prompt, limit: 8 }),
    toolQueryFinancialRecords(session, { scope: "ALL" }),
    toolRetrieveHistoricalDecisions(session, { query: prompt }),
    toolSearchPublicBenchmarks(session, { query: prompt }),
  ]);

  toolTrace.push({
    tool: "retrieve_company_intelligence",
    summary: `Retrieved ${intel.results.length} authorized records (${intel.restrictedRecordsOmittedForRole} restricted records filtered for role ${session.user.role}).`,
  });
  toolTrace.push({
    tool: "query_financial_records",
    summary: `Queried live ledger: Cash ${formatCurrency(
      fin.recordedCashBalance,
      fin.currency
    )}, Budgets ${formatCurrency(
      fin.approvedBudgetTotal,
      fin.currency
    )}, Remaining ${formatCurrency(fin.remainingBudgetTotal, fin.currency)}.`,
  });
  toolTrace.push({
    tool: "retrieve_historical_decisions",
    summary: `Checked ${decisions.count} recorded strategic decision(s).`,
  });
  toolTrace.push({
    tool: "search_public_benchmarks",
    summary: publicBench.postCutoffWarning
      ? `Enforced cutoff (${session.company.historicalCutoffDate}): post-cutoff topics excluded.`
      : `Checked ${publicBench.publicRecords.length} public historical benchmark section(s).`,
  });

  // Detect scenario/capacity question OR expansion cost question
  const needsScenarioModel =
    /how many|over\s+\d+\s+year|10\s*year|5\s*year|scenario|capacity|deploy|rollout|expand|region|corridor|supercharger|station|budget|cost/i.test(
      lower
    );

  const scenarioParams = extractHorizonAndUnits(prompt, isTesla);
  const scenarioResult = needsScenarioModel
    ? await toolCalculateFinancialScenario(session, scenarioParams)
    : null;

  if (scenarioResult) {
    toolTrace.push({
      tool: "calculate_financial_scenario",
      summary: `Computed 3-scenario ${scenarioResult.horizonYears}-year model (${scenarioResult.baseline.totalUnitsDeployed} ${scenarioResult.unitLabel} baseline; cost range ${formatCurrency(
        scenarioResult.optimistic.totalEstimatedCost,
        fin.currency
      )}–${formatCurrency(
        scenarioResult.adverse.totalEstimatedCost,
        fin.currency
      )}).`,
    });
  }

  // Detect multi-speaker or multi-domain conflict
  const speakerClaims = detectConflictingSpeakers(prompt, recentTranscript);
  const mentionsConflictKeywords =
    speakerClaims.length >= 2 ||
    /disagree|conflict|ceo|cfo|cto|versus|vs\.|against|oppose|cannot support|infrastructure cannot/i.test(
      lower
    );

  let conflictAnalysis: StructuredBoardroomResponse["conflictAnalysis"];
  if (mentionsConflictKeywords) {
    const cfoConcern =
      speakerClaims.find((s) => s.role === "CFO")?.claim ??
      "Capital liquidity, cash burn, and current negative manufacturing margin limit aggressive un-gated CapEx.";
    const ceoPush =
      speakerClaims.find((s) => s.role === "CEO")?.claim ??
      "Accelerated expansion is essential to eliminate customer range anxiety / capture market leadership early.";
    const ctoConstraint =
      speakerClaims.find((s) => s.role === "CTO")?.claim ??
      "Current engineering bandwidth, grid interconnection lead times, and hardware/production capacity cannot absorb unrestricted rollout.";

    conflictAnalysis = {
      hasConflict: true,
      underlyingConflict:
        "Growth acceleration & competitive moat (Commercial/CEO) vs. liquidity preservation & negative operating margin risk (Finance/CFO) vs. engineering, supply-chain & grid capacity bottlenecks (Technology/CTO).",
      perspectives: [
        {
          roleOrSpeaker: "CEO / Growth Position",
          position: ceoPush,
          evidenceCheck: isTesla
            ? "Supported by public Sept 2012 Supercharger strategic positioning: long-distance charging differentiates Model S against Nissan Leaf and luxury ICE sedans."
            : "Supported by commercial pipeline demand for multi-region fleet telemetry and charging coverage.",
          unsupportedAssumptions: [
            "Assumes customer conversion and regional demand scale fast enough to offset upfront CapEx without diluting core production cash.",
          ],
        },
        {
          roleOrSpeaker: "CFO / Capital Discipline Position",
          position: cfoConcern,
          evidenceCheck: `Supported by live financial ledger: recorded cash balance is ${formatCurrency(
            fin.recordedCashBalance,
            fin.currency
          )}, approved remaining budgets total ${formatCurrency(
            fin.remainingBudgetTotal,
            fin.currency
          )}, and upcoming 30-day obligations are ${formatCurrency(
            fin.upcomingObligations30d,
            fin.currency
          )}.`,
          unsupportedAssumptions: [
            "Assumes expansion must be funded as a rigid lump-sum commitment rather than milestone-gated tranches.",
          ],
        },
        {
          roleOrSpeaker: "CTO / Engineering & Operations Position",
          position: ctoConstraint,
          evidenceCheck:
            "Supported by operational records: utility transformer procurement, site permitting, and field engineering capacity create non-linear deployment bottlenecks.",
          unsupportedAssumptions: [
            "Assumes existing internal engineering teams must execute all civil works without turnkey EPC/site-host partnerships.",
          ],
        },
      ],
      balancedAssessment:
        "Neither unrestricted expansion nor a total freeze is optimal. The evidence confirms the CFO's liquidity caution and the CTO's grid/engineering constraints are grounded in current capacity limits, while the CEO's competitive thesis requires selective corridor coverage rather than broad saturation.",
      recommendedAlternatives: [
        "Option A (Recommended): Milestone-Gated Phase 1 Pilot — cap initial tranche within existing remaining budget and gate Phase 2 on core product gross-margin improvement and cash-floor covenant (> 2 quarters of runway).",
        "Option B: Site-Host & Utility Co-Investment — partner with commercial retail corridors / highway plazas for land & electrical trenching to reduce per-unit CapEx by 15–25%.",
        "Option C: Hardware Pre-Staging with Modular Commissioning — build standardized 4-stall foundations first and add power cabinets only as regional utilization crosses 35%.",
      ],
    };
  }

  // Handle post-2012 cutoff check explicitly
  if (publicBench.postCutoffWarning) {
    return {
      mode: "DETERMINISTIC_TOOL_ENGINE",
      modelLabel: "Deterministic Tool Orchestrator (No External LLM Key)",
      historicalCutoffApplied: session.company.historicalCutoffDate,
      directAnswer: `${publicBench.postCutoffWarning}\n\nWithin the verified pre-${session.company.historicalCutoffDate} knowledge base, Tesla Motors (as of late 2012) had delivered early Model S sedans following the June 22, 2012 launch, ended Roadster production, unveiled the initial 6 California Supercharger stations (Sept 24, 2012), and held Q3 2012 / Q4 2012 follow-on offering liquidity to fund the Model S production ramp.`,
      supportingEvidence: publicBench.publicRecords.map((r) => ({
        claim: r.summary,
        source: r.sourceCitation,
        verificationBadge: "VERIFIED_PUBLIC",
      })),
      counterargument:
        "Historical simulation boundaries prohibit extrapolating post-cutoff product lines or capital raises into 2012 board decisions.",
      financialImpact: `Current recorded demo cash balance: ${formatCurrency(
        fin.recordedCashBalance,
        fin.currency
      )}; Approved budgets: ${formatCurrency(fin.approvedBudgetTotal, fin.currency)}.`,
      operationalImpact:
        "Any strategic evaluation must rely solely on pre-December 2012 vehicle ramp data and initial 6-station Supercharger engineering specs.",
      risks: [
        "Relying on hindsight beyond the historical cutoff would invalidate boardroom stress-testing.",
      ],
      uncertaintiesAndMissingData: [
        "Post-2012 market demand, battery cell cost declines, and future equity market conditions are intentionally excluded.",
      ],
      suggestedNextQuestions: [
        "Based strictly on late-2012 cash reserves and Model S ramp data, how should we phase Supercharger Phase 1?",
        "Evaluate the CEO vs CFO vs CTO disagreement on corridor expansion.",
      ],
      toolTrace,
    };
  }

  const supportingEvidence: StructuredBoardroomResponse["supportingEvidence"] = [
    ...intel.results.slice(0, 4).map((r) => ({
      claim: r.content.slice(0, 220).replace(/\n+/g, " ") + (r.content.length > 220 ? "..." : ""),
      source: r.source,
      verificationBadge:
        (r.verificationStatus as StructuredBoardroomResponse["supportingEvidence"][number]["verificationBadge"]) ||
        "SYNTHETIC_RECORD",
    })),
    {
      claim: `Recorded Cash Balance: ${formatCurrency(
        fin.recordedCashBalance,
        fin.currency
      )}; Open Receivables: ${formatCurrency(
        fin.outstandingReceivables,
        fin.currency
      )}; Open Payables: ${formatCurrency(fin.outstandingPayables, fin.currency)}.`,
      source: `${fin.recordedBalanceSource} (Live Corporate Financial Ledger)`,
      verificationBadge: "SYNTHETIC_RECORD",
    },
  ];

  let directAnswer = "";
  if (conflictAnalysis) {
    directAnswer = `Cross-domain boardroom analysis indicates a three-way tension between strategic market expansion, liquidity preservation, and infrastructure/engineering bandwidth. Based on ${session.company.name}'s recorded cash balance (${formatCurrency(
      fin.recordedCashBalance,
      fin.currency
    )}), remaining approved budget (${formatCurrency(
      fin.remainingBudgetTotal,
      fin.currency
    )}), and ${intel.results.length} retrieved intelligence records, an un-gated expansion introduces material cash and execution risk. A milestone-gated phased rollout is strongly favored over an all-in commitment.`;
  } else if (scenarioResult) {
    directAnswer = `Based on explicit unit-cost assumptions (NOT guaranteed forecasts) and ${session.company.name}'s current recorded cash balance of ${formatCurrency(
      fin.recordedCashBalance,
      fin.currency
    )}, a ${scenarioResult.horizonYears}-year rollout yields a capacity range of ${scenarioResult.adverse.totalUnitsDeployed} (Adverse) to ${scenarioResult.optimistic.totalUnitsDeployed} (Optimistic) ${scenarioResult.unitLabel}, with Baseline at ${scenarioResult.baseline.totalUnitsDeployed} units.\n\nTotal ${scenarioResult.horizonYears}-year estimated CapEx + OpEx ranges from ${formatCurrency(
      scenarioResult.optimistic.totalEstimatedCost,
      fin.currency
    )} (Optimistic) to ${formatCurrency(
      scenarioResult.adverse.totalEstimatedCost,
      fin.currency
    )} (Adverse), with Baseline at ${formatCurrency(
      scenarioResult.baseline.totalEstimatedCost,
      fin.currency
    )} (peak annual cash draw ${formatCurrency(
      scenarioResult.baseline.peakAnnualCashDraw,
      fin.currency
    )}).`;
  } else {
    const topSnippet = intel.results[0]?.content.slice(0, 260) ?? "No matching intelligence sections found.";
    directAnswer = `For ${session.company.name}, retrieved company intelligence and live financial records indicate:\n\n${topSnippet}\n\nFrom a corporate finance standpoint, recorded cash stands at ${formatCurrency(
      fin.recordedCashBalance,
      fin.currency
    )} with ${formatCurrency(
      fin.remainingBudgetTotal,
      fin.currency
    )} remaining across approved budgets and ${fin.pendingApprovals.length} payment request(s) awaiting human authorization.`;
  }

  const financialImpact = scenarioResult
    ? `Baseline ${scenarioResult.horizonYears}-year CapEx: ${formatCurrency(
        scenarioResult.baseline.totalCapex,
        fin.currency
      )}; OpEx: ${formatCurrency(
        scenarioResult.baseline.totalOpexOverHorizon,
        fin.currency
      )}; Total Baseline Cost: ${formatCurrency(
        scenarioResult.baseline.totalEstimatedCost,
        fin.currency
      )} (${scenarioResult.baseline.cashReserveCoveragePct}% of current recorded cash reserve if unfunded by operating cash flow). Approved remaining budgets today: ${formatCurrency(
        fin.remainingBudgetTotal,
        fin.currency
      )}.`
    : `Recorded Cash: ${formatCurrency(
        fin.recordedCashBalance,
        fin.currency
      )} | Incoming Completed: ${formatCurrency(
        fin.totalIncomingCompleted,
        fin.currency
      )} | Outgoing Completed: ${formatCurrency(
        fin.totalOutgoingCompleted,
        fin.currency
      )} | Forecasted 30-day Cash Consumption: ${formatCurrency(
        fin.forecastedCashConsumption30d,
        fin.currency
      )} (projected, not deducted from cash balance).`;

  const operationalImpact = scenarioResult
    ? `Baseline requires scaling field/engineering support to ~${scenarioResult.baseline.workforceRequirement} dedicated FTEs over ${scenarioResult.baseline.estimatedTimelineMonths} months, subject to permitting and utility grid interconnection lead times.`
    : `Departmental spending must stay within remaining allocations across ${fin.budgets.length} tracked budgets while honoring ${decisions.count} recorded strategic resolution(s).`;

  const risks = [
    ...(scenarioResult?.baseline.risks ?? []),
    fin.overduePayables > 0
      ? `Overdue payables currently stand at ${formatCurrency(
          fin.overduePayables,
          fin.currency
        )}, requiring priority liquidity allocation.`
      : "No overdue payables currently recorded, though upcoming 30-day commitments require cash monitoring.",
    "Executing unbudgeted multi-year CapEx without milestone gates risks covenant breaches or emergency equity dilution.",
  ];

  const uncertaintiesAndMissingData = [
    "No probability percentages are assigned because empirical failure/success distributions for multi-year deployments are not available.",
    isTesla
      ? "Post-December 2012 battery cost curve reductions and Model S steady-state warranty costs are unknown within this historical cutoff."
      : "Long-term customer utilization rates across newly opened regions remain management assumptions until pilot telemetry is collected.",
    intel.restrictedRecordsOmittedForRole > 0
      ? `${intel.restrictedRecordsOmittedForRole} company record(s) were omitted due to RBAC/ABAC access restrictions for role ${session.user.role}.`
      : "All company records permitted for current user role were inspected.",
  ];

  const suggestedDecisionDraft =
    conflictAnalysis || scenarioResult
      ? {
          title: conflictAnalysis
            ? "Phased Infrastructure Expansion (Milestone-Gated Phase 1)"
            : `${scenarioParams.horizonYears}-Year ${scenarioParams.unitLabel} Phased Plan`,
          objective:
            "Balance strategic network/market expansion against capital runway and engineering capacity constraints.",
          selectedOption:
            "Approve Phase 1 milestone-gated pilot budget only; defer full rollout pending Q+1 gross margin and site-cost actuals.",
          alternativesConsidered:
            "1) Aggressive immediate full rollout; 2) Total expansion freeze; 3) Milestone-gated Phase 1 pilot with co-investment partners.",
          rationale:
            "Preserves liquidity cushion while validating unit CapEx, utility lead times, and utilization telemetry before committing multi-year capital.",
          assumptions: `Unit CapEx ~${formatCurrency(
            scenarioParams.unitCapex,
            fin.currency
          )}, Annual OpEx ~${formatCurrency(
            scenarioParams.annualOpexPerUnit,
            fin.currency
          )}/unit.`,
          risks: risks.join(" "),
          financialImplications: financialImpact,
          estimatedCost: scenarioResult
            ? Math.round(scenarioResult.baseline.yearlySeries[0]?.annualCapex ?? 450000)
            : 450000,
        }
      : undefined;

  return {
    mode: "DETERMINISTIC_TOOL_ENGINE",
    modelLabel: "Deterministic Tool Orchestrator (No External LLM Key)",
    historicalCutoffApplied: session.company.historicalCutoffDate,
    directAnswer,
    conflictAnalysis,
    supportingEvidence,
    counterargument: conflictAnalysis
      ? "Deferring aggressive expansion reduces near-term cash burn, but risks allowing competitors to secure prime corridor real estate or early fleet accounts if market adoption accelerates faster than baseline."
      : "Even with positive strategic alignment, unmodeled supplier delays or higher customer acquisition costs could compress operating runway more rapidly than baseline estimates assume.",
    financialImpact,
    operationalImpact,
    risks,
    uncertaintiesAndMissingData,
    suggestedNextQuestions: [
      "What cash-balance trigger should automatically pause Phase 2 capital expenditure?",
      "Which vendor contracts and open payables would compete with this initiative over the next 30 days?",
      "Model an Adverse scenario where unit CapEx rises 25% and permitting delays rollout by 12 months.",
    ],
    toolTrace,
    suggestedScenarioParams: scenarioResult
      ? {
          title: scenarioResult.title,
          horizonYears: scenarioResult.horizonYears,
          targetUnits: scenarioResult.input.targetUnits,
          unitCapex: scenarioResult.input.unitCapex,
          annualOpexPerUnit: scenarioResult.input.annualOpexPerUnit,
          annualRevenuePerUnit: scenarioResult.input.annualRevenuePerUnit,
          workingCapitalReserve: fin.recordedCashBalance,
        }
      : undefined,
    suggestedDecisionDraft,
  };
}

export async function orchestrateBoardroomQuery(
  input: BoardroomOrchestrationInput
): Promise<StructuredBoardroomResponse> {
  const providerPref = (process.env.LLM_PROVIDER || "auto").toLowerCase();
  let fallbackReason: string | undefined;

  if (
    providerPref !== "deterministic" &&
    (providerPref === "gemini" ||
      (providerPref === "auto" && process.env.GEMINI_API_KEY?.trim()))
  ) {
    try {
      const attempt = await runGeminiOrchestration(input);
      if (attempt.response) return attempt.response;
      fallbackReason = attempt.fallbackReason;
    } catch (err) {
      fallbackReason = `Gemini error: ${String(err).slice(0, 80)}`;
    }
  }

  const deterministic = await runDeterministicToolOrchestration(input);
  if (fallbackReason) {
    deterministic.modelLabel = `Deterministic Tool Engine (Fallback: ${fallbackReason})`;
  }
  return deterministic;
}
