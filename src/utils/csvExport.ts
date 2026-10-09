/**
 * CSV Export Utility
 * Converts arrays of objects to CSV format and triggers download
 */

type ExportValue = string | number | boolean | null | undefined;
type ExportRow = Record<string, ExportValue>;

export function exportToCSV(
  data: ExportRow[],
  fileName: string,
  columns?: string[]
): void {
  if (data.length === 0) {
    alert("No data to export");
    return;
  }

  // Use provided columns or extract from first row
  const headers = columns || Object.keys(data[0]);

  // Build CSV content
  const csvContent = [
    // Header row
    headers.map(escapeCSVField).join(","),
    // Data rows
    ...data.map((row) =>
      headers.map((col) => escapeCSVField(row[col] ?? "")).join(",")
    ),
  ].join("\n");

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}_${timestamp}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Escape special CSV characters
 */
function escapeCSVField(field: ExportValue): string {
  const str = String(field ?? "").trim();

  // If field contains comma, newline, or quotes, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Export to XLSX (requires XLSX library)
 * Install: npm install xlsx
 */
export async function exportToXLSX(
  data: ExportRow[],
  fileName: string,
  columns?: string[]
): Promise<void> {
  try {
    // Dynamically import XLSX to keep bundle size smaller
    const XLSX = await import("xlsx");

    const headers = columns || Object.keys(data[0]);
    const ws_data = [headers, ...data.map((row) => headers.map((col) => row[col] ?? ""))];

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${fileName}_${timestamp}.xlsx`);
  } catch (error) {
    console.error("Failed to export XLSX:", error);
    alert("XLSX export requires xlsx library. Falling back to CSV.");
    exportToCSV(data, fileName, columns);
  }
}

/**
 * Export multiple sheets to XLSX
 */
export async function exportMultipleSheets(
  sheets: Array<{ name: string; data: ExportRow[]; columns?: string[] }>,
  fileName: string
): Promise<void> {
  try {
    const XLSX = await import("xlsx");

    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
      const headers = sheet.columns || Object.keys(sheet.data[0]);
      const ws_data = [headers, ...sheet.data.map((row) => headers.map((col) => row[col] ?? ""))];
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)); // Excel sheet name limit
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${fileName}_${timestamp}.xlsx`);
  } catch (error) {
    console.error("Failed to export multiple sheets:", error);
    alert("XLSX export requires xlsx library.");
  }
}
