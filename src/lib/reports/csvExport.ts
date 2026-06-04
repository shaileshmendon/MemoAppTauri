/**
 * csvExport.ts — CSV generation for Memo reports
 *
 * Requirements:
 * - UTF-8 BOM (so Excel on macOS/Windows displays ₹ correctly)
 * - Raw numeric values (not formatted) for spreadsheet calculations
 * - ISO dates (YYYY-MM-DD) so they sort correctly
 * - Header row: human-readable column names
 * - Save via Tauri dialog.save → plugin-fs.writeTextFile
 */

import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

const BOM = "﻿";

/** Escapes a CSV cell value (wraps in quotes if contains comma/quote/newline). */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Converts an array of objects to a CSV string with BOM. */
export function objectsToCsv(headers: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const headerRow = headers.map(h => escapeCell(h.label)).join(",");
  const dataRows  = rows.map(row =>
    headers.map(h => escapeCell(row[h.key])).join(",")
  );
  return BOM + [headerRow, ...dataRows].join("\r\n");
}

/** Opens a native save dialog and writes the CSV file. */
export async function saveCsvFile(filename: string, csv: string): Promise<void> {
  const path = await save({
    defaultPath: filename,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return; // user cancelled
  await writeTextFile(path, csv);
}
