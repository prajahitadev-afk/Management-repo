export type FormField = {
  key: string;
  label: string;
  type?: "number" | "date" | "select";
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
};

export type FormDefinition = {
  kind: string;
  title: string;
  fields: FormField[];
};

export function DepartmentFormModal({
  definition,
  values,
  error,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  definition: FormDefinition;
  values: Record<string, string>;
  error: string;
  submitting: boolean;
  onChange: (key: string, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const hasEmptyOptions = definition.fields.some(
    (field) => field.type === "select" && !field.options?.length,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="department-form-title"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="department-form-title" className="text-lg font-semibold text-slate-800">
            {definition.title}
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {definition.fields.map((field) => (
            <label key={field.key} className="text-sm text-slate-700">
              <span>{field.label}{field.required ? " *" : ""}</span>
              {field.type === "select" ? (
                <select
                  required={field.required}
                  value={values[field.key] ?? ""}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-[#4e8050]"
                >
                  <option value="">Select an option</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  required={field.required}
                  type={field.type ?? "text"}
                  min={field.type === "number" ? "0.01" : undefined}
                  value={values[field.key] ?? ""}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#4e8050]"
                />
              )}
            </label>
          ))}
        </div>

        {hasEmptyOptions && (
          <p className="mt-2 text-xs text-amber-700">
            No matching records are available. Create the required batch or trip first.
          </p>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || hasEmptyOptions}
            className="rounded-lg bg-[#4e8050] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
