import { parse as parseCsvSync } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { extractText } from "unpdf";

export interface ParsedDocumentOutput {
  fileType: "PDF" | "CSV" | "XLSX" | "TXT";
  extractionStatus: "COMPLETED" | "PARTIAL" | "FAILED";
  extractedSummary: string;
  associatedInfo: string;
  chunks: Array<{
    index: number;
    content: string;
    metadata: Record<string, unknown>;
  }>;
  detectedStructuredRows?: Array<Record<string, string | number>>;
}

function chunkText(text: string, maxChars = 900): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return [];
  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length <= maxChars) {
      current = current ? `${current}\n\n${p}` : p;
    } else {
      if (current) chunks.push(current);
      if (p.length <= maxChars) {
        current = p;
      } else {
        for (let i = 0; i < p.length; i += maxChars) {
          chunks.push(p.slice(i, i + maxChars));
        }
        current = "";
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function parseUploadedDocument(params: {
  fileName: string;
  buffer: Buffer;
  category: string;
}): Promise<ParsedDocumentOutput> {
  const lower = params.fileName.toLowerCase();

  try {
    if (lower.endsWith(".pdf")) {
      const result = await extractText(new Uint8Array(params.buffer), {
        mergePages: true,
      });
      const text = typeof result.text === "string" ? result.text.trim() : "";
      const chunks = chunkText(text).map((content, index) => ({
        index,
        content,
        metadata: { totalPages: result.totalPages, fileType: "PDF" },
      }));
      return {
        fileType: "PDF",
        extractionStatus: chunks.length > 0 ? "COMPLETED" : "PARTIAL",
        extractedSummary:
          text.slice(0, 420) ||
          `PDF parsed (${result.totalPages} pages), no selectable text layer detected.`,
        associatedInfo: `Category: ${params.category} · ${result.totalPages} page(s), ${chunks.length} indexed chunk(s)`,
        chunks,
      };
    }

    if (lower.endsWith(".csv")) {
      const raw = params.buffer.toString("utf8");
      const records = parseCsvSync(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Array<Record<string, string>>;

      const headers = records.length > 0 ? Object.keys(records[0]) : [];
      const rowLines = records.map(
        (row, idx) =>
          `Row ${idx + 1}: ` +
          headers.map((h) => `${h}=${row[h] ?? ""}`).join(" | ")
      );
      const fullText = `CSV Headers: ${headers.join(", ")}\n\n${rowLines.join("\n")}`;
      const chunks = chunkText(fullText).map((content, index) => ({
        index,
        content,
        metadata: { rowCount: records.length, headers, fileType: "CSV" },
      }));
      return {
        fileType: "CSV",
        extractionStatus: records.length > 0 ? "COMPLETED" : "PARTIAL",
        extractedSummary: `Parsed CSV table with ${records.length} row(s) and columns [${headers.join(", ")}].`,
        associatedInfo: `Category: ${params.category} · ${records.length} structured row(s)`,
        chunks,
        detectedStructuredRows: records,
      };
    }

    if (lower.endsWith(".xlsx")) {
      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(params.buffer as any);
      const sheetTexts: string[] = [];
      const detectedRows: Array<Record<string, string | number>> = [];

      workbook.eachSheet((worksheet) => {
        const rows: string[] = [];
        let headers: string[] = [];
        worksheet.eachRow((row, rowNumber) => {
          const vals = (row.values as Array<unknown>)
            .slice(1)
            .map((v) => (v === null || v === undefined ? "" : String(v).trim()));
          if (rowNumber === 1) {
            headers = vals.map((v, i) => v || `Column_${i + 1}`);
          } else {
            const obj: Record<string, string | number> = {
              _sheet: worksheet.name,
            };
            headers.forEach((h, idx) => {
              const rawVal = vals[idx] ?? "";
              const numVal = Number(rawVal.replace(/[$,]/g, ""));
              obj[h] =
                rawVal !== "" && !Number.isNaN(numVal) && /^-?[\d,.]+$/.test(rawVal)
                  ? numVal
                  : rawVal;
            });
            detectedRows.push(obj);
            rows.push(
              `Row ${rowNumber - 1}: ` +
                headers.map((h, i) => `${h}=${vals[i] ?? ""}`).join(" | ")
            );
          }
        });
        sheetTexts.push(
          `Sheet "${worksheet.name}" (${headers.join(", ")}):\n${rows.join("\n")}`
        );
      });

      const fullText = sheetTexts.join("\n\n");
      const chunks = chunkText(fullText).map((content, index) => ({
        index,
        content,
        metadata: {
          sheetCount: workbook.worksheets.length,
          rowCount: detectedRows.length,
          fileType: "XLSX",
        },
      }));

      return {
        fileType: "XLSX",
        extractionStatus: detectedRows.length > 0 ? "COMPLETED" : "PARTIAL",
        extractedSummary: `Parsed Excel workbook (${workbook.worksheets.length} sheet(s), ${detectedRows.length} data row(s)).`,
        associatedInfo: `Category: ${params.category} · ${workbook.worksheets.length} sheet(s), ${detectedRows.length} row(s)`,
        chunks,
        detectedStructuredRows: detectedRows,
      };
    }

    // TXT / MD / JSON fallback
    const text = params.buffer.toString("utf8").trim();
    const chunks = chunkText(text).map((content, index) => ({
      index,
      content,
      metadata: { fileType: "TXT" },
    }));
    return {
      fileType: "TXT",
      extractionStatus: chunks.length > 0 ? "COMPLETED" : "PARTIAL",
      extractedSummary: text.slice(0, 420) || "Empty text file.",
      associatedInfo: `Category: ${params.category} · ${chunks.length} indexed chunk(s)`,
      chunks,
    };
  } catch (err) {
    return {
      fileType: lower.endsWith(".pdf")
        ? "PDF"
        : lower.endsWith(".csv")
        ? "CSV"
        : lower.endsWith(".xlsx")
        ? "XLSX"
        : "TXT",
      extractionStatus: "FAILED",
      extractedSummary: `Extraction failed: ${String(err)}`,
      associatedInfo: `Error parsing ${params.fileName}`,
      chunks: [],
    };
  }
}

