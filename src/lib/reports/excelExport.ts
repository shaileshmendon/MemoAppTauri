/**
 * excelExport.ts — Excel (.xlsx) export for Memo reports using ExcelJS
 *
 * Features per sheet:
 * - Frozen header row
 * - Auto-filters on header row
 * - Auto-sized columns (estimated)
 * - INR currency number format (#,##0.00 ₹)
 * - Date format (DD-MMM-YYYY)
 * - Bold header row with grey background
 * - Numeric cells right-aligned
 *
 * Save via Tauri dialog.save → plugin-fs writeBinaryFile
 */

import ExcelJS from "exceljs";
import { save }            from "@tauri-apps/plugin-dialog";
import { writeFile }       from "@tauri-apps/plugin-fs";

// ── Column descriptor ─────────────────────────────────────────────────────────

export type ColType = "text" | "number" | "currency" | "date" | "integer";

export interface ColDef {
  key:     string;
  header:  string;
  type:    ColType;
  width?:  number; // character width hint
}

// ── Styles ────────────────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type:    "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5E7EB" }, // neutral-200
};

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, size: 10 };

const CURRENCY_FORMAT = '₹#,##0.00;[Red]-₹#,##0.00';
const DATE_FORMAT     = "DD-MMM-YYYY";
const INTEGER_FORMAT  = "#,##0";

// ── Core builder ──────────────────────────────────────────────────────────────

/**
 * Creates a single worksheet in `workbook` and populates it.
 */
export function addReportSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  columns: ColDef[],
  rows: Record<string, unknown>[]
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet(sheetName);

  // Define columns
  ws.columns = columns.map(c => ({
    key:   c.key,
    width: c.width ?? estimateWidth(c),
  }));

  // Header row
  const headerRow = ws.addRow(columns.map(c => c.header));
  headerRow.font    = HEADER_FONT;
  headerRow.fill    = HEADER_FILL;
  headerRow.height  = 20;
  headerRow.alignment = { vertical: "middle" };

  // Apply auto-filter to entire header row
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: columns.length },
  };

  // Freeze the header row
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Data rows
  for (const rowData of rows) {
    const values = columns.map(c => {
      const v = rowData[c.key];
      if (v === null || v === undefined) return "";
      return v;
    });
    const excelRow = ws.addRow(values);

    // Apply per-cell formatting
    columns.forEach((col, idx) => {
      const cell = excelRow.getCell(idx + 1);
      switch (col.type) {
        case "currency":
          cell.numFmt    = CURRENCY_FORMAT;
          cell.alignment = { horizontal: "right" };
          break;
        case "number":
          cell.numFmt    = INTEGER_FORMAT;
          cell.alignment = { horizontal: "right" };
          break;
        case "integer":
          cell.numFmt    = INTEGER_FORMAT;
          cell.alignment = { horizontal: "right" };
          break;
        case "date":
          if (typeof cell.value === "string" && cell.value) {
            cell.value     = new Date(cell.value);
            cell.numFmt    = DATE_FORMAT;
          }
          cell.alignment = { horizontal: "center" };
          break;
        default:
          cell.alignment = { horizontal: "left" };
      }
    });
  }

  // Total rows at bottom for numeric/currency columns
  const totals: (number | string | null)[] = columns.map(col => {
    if (col.type === "currency" || col.type === "number") {
      const sum = rows.reduce((acc, r) => {
        const v = r[col.key];
        return acc + (typeof v === "number" ? v : 0);
      }, 0);
      return sum;
    }
    return null;
  });

  if (totals.some(t => t !== null)) {
    // Label in first cell
    totals[0] = "TOTAL";
    const totalRow = ws.addRow(totals);
    totalRow.font = { bold: true };
    totalRow.fill = HEADER_FILL;
    columns.forEach((col, idx) => {
      const cell = totalRow.getCell(idx + 1);
      if (col.type === "currency") {
        cell.numFmt    = CURRENCY_FORMAT;
        cell.alignment = { horizontal: "right" };
      } else if (col.type === "number" || col.type === "integer") {
        cell.numFmt    = INTEGER_FORMAT;
        cell.alignment = { horizontal: "right" };
      }
    });
  }

  // Apply border to all data cells
  const lastRow = ws.lastRow?.number ?? 1;
  for (let r = 1; r <= lastRow; r++) {
    for (let c = 1; c <= columns.length; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    }
  }

  return ws;
}

function estimateWidth(col: ColDef): number {
  const headerLen = col.header.length;
  switch (col.type) {
    case "currency": return Math.max(headerLen, 14);
    case "date":     return Math.max(headerLen, 13);
    case "integer":  return Math.max(headerLen, 8);
    case "number":   return Math.max(headerLen, 10);
    default:         return Math.max(headerLen, 20);
  }
}

// ── File save ─────────────────────────────────────────────────────────────────

/**
 * Writes an ExcelJS workbook to disk via a native save dialog.
 * Returns true on success, false if user cancelled.
 */
export async function saveWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<boolean> {
  const path = await save({
    defaultPath: filename,
    filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
  });
  if (!path) return false;

  const buffer = await workbook.xlsx.writeBuffer();
  await writeFile(path, new Uint8Array(buffer as ArrayBuffer));
  return true;
}

// ── Single-report helper ──────────────────────────────────────────────────────

/** Convenience: create a workbook with one sheet and save it. */
export async function exportSingleSheet(
  filename: string,
  sheetName: string,
  columns: ColDef[],
  rows: Record<string, unknown>[]
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator    = "Memo";
  wb.created    = new Date();
  wb.modified   = new Date();

  addReportSheet(wb, sheetName, columns, rows);
  await saveWorkbook(wb, filename);
}
