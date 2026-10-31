export type TableColumn = {
  label: string;
  value: (row: Record<string, unknown>) => string;
  action?: boolean;
};

function valueFor(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

export function DepartmentDataTable({
  loading,
  error,
  rows,
  columns,
  onReviewDefect,
}: {
  loading: boolean;
  error: string;
  rows: Record<string, unknown>[];
  columns: TableColumn[];
  onReviewDefect?: (row: Record<string, unknown>) => void;
}) {
  if (loading) return <p className="mt-4 text-sm text-slate-600">Loading records...</p>;
  if (error) return <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>;
  if (!rows.length) return <p className="mt-4 text-sm text-slate-600">No records found</p>;

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-slate-500">
            {columns.map((column) => <th key={column.label} className="px-3 py-2 font-semibold">{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={valueFor(row, "id") !== "-" ? valueFor(row, "id") : String(index)} className="border-b border-black/5 text-slate-700">
              {columns.map((column) => (
                <td key={column.label} className="px-3 py-3">
                  {column.action
                    ? row.status === "Open"
                      ? <button type="button" onClick={() => onReviewDefect?.(row)} className="rounded-md bg-[#4e8050] px-3 py-1.5 text-xs font-medium text-white">Review</button>
                      : <span className="text-slate-500">Reviewed</span>
                    : column.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
