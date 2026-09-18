"use client";
import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

const FIELDS = [
  { key: "name", label: "Name", required: true, aliases: ["name", "full name", "lead", "contact", "customer", "client"] },
  { key: "phone", label: "Phone", required: true, aliases: ["phone", "mobile", "phone number", "contact number", "tel", "telephone", "number"] },
  { key: "email", label: "Email", required: false, aliases: ["email", "e-mail", "mail", "email id"] },
  { key: "source", label: "Source", required: false, aliases: ["source", "lead source"] },
  { key: "city", label: "City", required: false, aliases: ["city", "location", "town", "address"] },
  { key: "notes", label: "Notes", required: false, aliases: ["notes", "note", "description", "remarks", "comment"] },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type Mapping = Record<FieldKey, string>;

function autoMap(headers: string[]): Mapping {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const m = {} as Mapping;
  for (const f of FIELDS) {
    const i = lower.findIndex((h) => (f.aliases as readonly string[]).includes(h));
    m[f.key] = i >= 0 ? headers[i] : "";
  }
  return m;
}

const cell = (r: Record<string, unknown>, col: string) => String(col ? r[col] ?? "" : "").trim();

export default function ImportLeads({ onDone }: { onDone: () => void }) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);

  async function handleFile(f: File) {
    setMsg(null);
    setFileName(f.name);
    const ext = f.name.split(".").pop()?.toLowerCase();
    let rows: Record<string, unknown>[] = [];
    let heads: string[] = [];
    if (ext === "csv") {
      const text = await f.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      rows = parsed.data;
      heads = parsed.meta.fields ?? Object.keys(rows[0] ?? {});
    } else {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      heads = Object.keys(rows[0] ?? {});
    }
    if (!heads.length) {
      setMsg({ kind: "err", text: "No columns found in this file. Check it has a header row." });
      return;
    }
    setHeaders(heads);
    setRaw(rows);
    setMapping(autoMap(heads));
  }

  function reset() {
    setHeaders([]);
    setRaw([]);
    setMapping(null);
    setFileName("");
  }

  const mappedCount = !mapping
    ? 0
    : raw.filter((r) => cell(r, mapping.name) || cell(r, mapping.phone)).length;

  async function doImport() {
    if (!mapping) return;
    if (!mapping.name && !mapping.phone) {
      setMsg({ kind: "err", text: "Map at least the Name or Phone column to continue." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    const cleaned = raw
      .map((r) => ({
        name: cell(r, mapping.name),
        phone: cell(r, mapping.phone),
        email: cell(r, mapping.email),
        source: cell(r, mapping.source),
        city: cell(r, mapping.city),
        notes: cell(r, mapping.notes),
      }))
      .filter((r) => r.name || r.phone);
    // dedupe by phone against DB
    const phones = [...new Set(cleaned.map((r) => r.phone).filter(Boolean))];
    let existing = new Set<string>();
    if (phones.length) {
      const { data } = await supabase.from("leads").select("phone").in("phone", phones);
      existing = new Set((data ?? []).map((d) => d.phone));
    }
    const toInsert = cleaned
      .filter((r) => !r.phone || !existing.has(r.phone))
      .map((r) => ({
        name: r.name || r.phone || "Unnamed",
        phone: r.phone || null,
        email: r.email || null,
        source: r.source || "import",
        city: r.city || null,
        notes: r.notes || null,
        status: "New" as const,
        created_by: user.user?.id ?? null,
      }));
    if (!toInsert.length) {
      setMsg({ kind: "info", text: "All rows already exist — matched by phone, nothing imported." });
      setBusy(false);
      return;
    }
    // ponytail: chunk insert, <1k rows client-side is fine
    const { error } = await supabase.from("leads").insert(toInsert);
    setBusy(false);
    if (error) setMsg({ kind: "err", text: error.message });
    else {
      setMsg({ kind: "ok", text: `Imported ${toInsert.length} leads (${cleaned.length - toInsert.length} duplicates skipped).` });
      reset();
      onDone();
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display font-bold">Import from file</h3>
        <p className="text-sm text-[#5B6472]">Upload a CSV or Excel file, map its columns, then import.</p>
      </div>

      {!mapping ? (
        <label className="block cursor-pointer rounded-lg border border-dashed border-[#BFDBFE] bg-[#F4F6FA] p-4 text-center text-sm hover:border-[#298DFF]">
          <span className="font-medium text-[#298DFF]">Choose a .csv or .xlsx file</span>
          <span className="block text-xs text-[#5B6472]">First row should be column headers</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="sr-only"
          />
        </label>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="min-w-0 truncate font-medium">{fileName}</span>
            <span className="text-[#5B6472]">· {raw.length} rows · {headers.length} columns</span>
            <button onClick={reset} className="ml-auto text-[#298DFF] hover:underline">Change file</button>
          </div>

          <div className="rounded-lg border border-[#E4E9F2] p-3">
            <p className="text-sm font-semibold">Map columns</p>
            <p className="text-xs text-[#5B6472]">Match each CRM field to a column in your file. At least Name or Phone is required.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <label key={f.key} className="text-sm font-medium">
                  {f.label} {f.required && <span className="text-[#5B6472]">(needed)</span>}
                  <select
                    aria-label={`Map ${f.label} column`}
                    className="field mt-1"
                    value={mapping[f.key]}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                  >
                    <option value="">— Ignore —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-[#5B6472]">
              {mappedCount} of {raw.length} rows have a name or phone and will be imported. Preview:
            </p>
            <ul className="mt-1 divide-y rounded-lg border border-[#E4E9F2] text-sm">
              {raw.slice(0, 5).map((r, i) => (
                <li key={i} className="px-3 py-1.5">
                  {cell(r, mapping.name) || <span className="text-[#5B6472]">No name</span>}
                  <span className="text-[#5B6472]"> · {cell(r, mapping.phone) || "no phone"} · {cell(r, mapping.email)}</span>
                </li>
              ))}
            </ul>
          </div>

          <button disabled={busy || !mappedCount} onClick={doImport} className="btn-primary w-full disabled:opacity-50">
            {busy ? "Importing…" : `Import ${mappedCount} leads`}
          </button>
        </>
      )}

      {msg && (
        <p role={msg.kind === "err" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${msg.kind === "err" ? "border-red-200 bg-red-50 text-red-700" : msg.kind === "ok" ? "border-green-200 bg-green-50 text-green-700" : "border-[#BFDBFE] bg-[#E3EFFF] text-[#0B0E13]"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
