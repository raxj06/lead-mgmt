"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STATUSES, STATUS_LABEL, STATUS_STYLES, type Lead, type Profile, type Status } from "@/lib/types";
import AddLeadForm from "@/components/AddLeadForm";
import ImportLeads from "@/components/ImportLeads";

function LeadsTable() {
  const params = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<string>(params.get("status") ?? "all");
  const [assigneeF, setAssigneeF] = useState<string>("all");
  const [sel, setSel] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const lastIdx = useRef<number | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    setMyId(user.user?.id ?? null);
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from("leads").select("*, profiles!leads_assigned_to_fkey(name,email)").order("created_at", { ascending: false }).limit(2000),
      supabase.from("profiles").select("id,name,email"),
    ]);
    setLeads((l as Lead[]) ?? []);
    setProfiles((p as Profile[]) ?? []);
    setSel([]);
    setLoading(false);
  }
  // fetch-on-mount from Supabase (external system sync)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return leads.filter((l) => {
      if (statusF !== "all" && l.status !== statusF) return false;
      if (assigneeF === "unassigned" && l.assigned_to) return false;
      if (assigneeF === "mine" && l.assigned_to !== myId) return false;
      if (assigneeF !== "all" && assigneeF !== "unassigned" && assigneeF !== "mine" && l.assigned_to !== assigneeF) return false;
      if (needle && !`${l.name} ${l.phone} ${l.email}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [leads, q, statusF, assigneeF, myId]);

  function toggle(id: string, idx: number, e?: React.ChangeEvent<HTMLInputElement>) {
    const shift = (e?.nativeEvent as MouseEvent | undefined)?.shiftKey;
    if (shift && lastIdx.current !== null) {
      // shift-click: select whole range between last click and this one
      const [a, b] = [lastIdx.current, idx].sort((x, y) => x - y);
      const ids = filtered.slice(a, b + 1).map((l) => l.id);
      setSel((s) => Array.from(new Set([...s, ...ids])));
    } else {
      setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    }
    lastIdx.current = idx;
  }

  async function bulkAssign() {
    if (!sel.length || !assignTo) return;
    setBanner(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({ status: "Assigned", assigned_to: assignTo })
      .in("id", sel);
    if (error) setBanner({ kind: "err", text: error.message });
    else {
      setBanner({ kind: "ok", text: `Assigned ${sel.length} lead${sel.length > 1 ? "s" : ""}.` });
      load();
    }
  }

  async function bulkUnassign() {
    if (!sel.length) return;
    const supabase = createClient();
    const { error } = await supabase.from("leads").update({ assigned_to: null }).in("id", sel);
    if (error) setBanner({ kind: "err", text: error.message });
    else {
      setBanner({ kind: "ok", text: `Unassigned ${sel.length} lead${sel.length > 1 ? "s" : ""}.` });
      load();
    }
  }

  async function bulkDelete() {
    if (!sel.length) return;
    if (!confirm(`Delete ${sel.length} lead${sel.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("leads").delete().in("id", sel);
    if (error) setBanner({ kind: "err", text: error.message });
    else {
      setBanner({ kind: "ok", text: `Deleted ${sel.length} lead${sel.length > 1 ? "s" : ""}.` });
      load();
    }
  }

  const nameOf = (id: string | null) =>
    profiles.find((p) => p.id === id)?.name ?? profiles.find((p) => p.id === id)?.email ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <div className="mr-auto">
          <h1 className="font-display text-2xl font-bold text-[#0B0E13]">Leads ({filtered.length})</h1>
          <p className="text-sm text-[#5B6472]">Select leads to assign, or open one to call.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button onClick={() => { setShowAdd(!showAdd); setShowImport(false); }} className="btn-primary">+ Add lead</button>
          <button onClick={() => { setShowImport(!showImport); setShowAdd(false); }} className="btn-ghost">Import CSV/XLSX</button>
        </div>
      </div>

      {showAdd && <div className="card max-w-xl p-4"><AddLeadForm onDone={load} /></div>}
      {showImport && <div className="card max-w-xl p-4"><ImportLeads onDone={load} /></div>}

      <div className="card grid gap-2 p-3 sm:flex sm:flex-wrap">
        <input
          placeholder="Search name, phone, or email"
          aria-label="Search leads"
          className="field min-w-0 flex-1 sm:min-w-40"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select aria-label="Filter by status" className="field w-full sm:w-auto" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s: Status) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="Filter by assignee" className="field w-full sm:w-auto" value={assigneeF} onChange={(e) => setAssigneeF(e.target.value)}>
          <option value="all">All assignees</option>
          <option value="mine">My leads</option>
          <option value="unassigned">Unassigned</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.name ?? p.email}</option>)}
        </select>
      </div>

      {banner && (
        <p role={banner.kind === "err" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${banner.kind === "err" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {banner.text}
        </p>
      )}

      {sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#BFDBFE] bg-[#E3EFFF] p-3 text-sm text-[#0B0E13]">
          <span className="font-semibold">{sel.length} selected</span>
          <select aria-label="Assign to teammate" className="field w-full sm:w-auto" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Assign to…</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name ?? p.email}</option>)}
          </select>
          <button onClick={bulkAssign} className="btn-dark flex-1 sm:flex-none">Assign</button>
          <button onClick={bulkUnassign} className="btn-ghost flex-1 sm:flex-none">Unassign</button>
          <button onClick={bulkDelete} className="rounded-lg border border-red-200 bg-white px-3 py-1 text-red-600 hover:bg-red-50">Delete</button>
          <button onClick={() => setSel([])} className="text-[#298DFF] hover:underline">Clear</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#E4E9F2] bg-[#F4F6FA] px-3 py-2 text-sm">
          <input type="checkbox" aria-label="Select all" checked={filtered.length > 0 && sel.length === filtered.length} onChange={() => { setSel(sel.length === filtered.length ? [] : filtered.map((l) => l.id)); lastIdx.current = null; }} />
          <span className="text-[#5B6472]">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
          <span className="ml-auto hidden text-xs text-[#9AA3B2] sm:block">Tip: shift-click to select a range</span>
        </div>
        <ul className="divide-y divide-[#E4E9F2]">
          {filtered.map((l, i) => (
            <li key={l.id} className={`flex gap-3 px-3 py-3 hover:bg-[#F4F6FA] ${sel.includes(l.id) ? "bg-[#E3EFFF]/40" : ""}`}>
              <input type="checkbox" aria-label={`Select ${l.name}`} className="mt-1.5" checked={sel.includes(l.id)} onChange={(e) => toggle(l.id, i, e)} />
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B0E13] font-display text-sm font-bold text-white">
                {l.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/dashboard/leads/${l.id}`} className="truncate font-display text-[15px] font-semibold text-[#0B0E13] hover:text-[#298DFF] hover:underline">
                    {l.name}
                  </Link>
                  <span className={`inline-block rounded-full border px-2 py-px text-[11px] font-medium ${STATUS_STYLES[l.status]}`}>{STATUS_LABEL[l.status]}</span>
                </div>
                <a href={l.phone ? `tel:${l.phone}` : undefined} onClick={(e) => e.stopPropagation()} className="mt-0.5 block font-mono text-[13px] font-medium text-[#1D6FF2]">
                  📞 {l.phone ?? "No phone"}
                </a>
                <p className="mt-0.5 truncate text-[13px] text-[#5B6472]">
                  {[l.email, l.website, l.city, l.source].filter(Boolean).join(" · ") || "No details yet"}
                </p>
                <p className="mt-0.5 text-xs text-[#5B6472]">
                  {nameOf(l.assigned_to) === "—" ? "Unassigned" : `Assigned to ${nameOf(l.assigned_to)}`}
                  {l.followup_date ? ` · ⏰ ${l.followup_date}` : ""}
                </p>
              </div>
              <Link href={`/dashboard/leads/${l.id}`} aria-label={`Open ${l.name}`} className="shrink-0 self-center rounded-full px-2 py-1 text-lg text-[#5B6472] hover:bg-white hover:text-[#298DFF]">›</Link>
            </li>
          ))}
        </ul>
        {loading && <p className="p-4 text-sm text-[#5B6472]">Loading leads…</p>}
        {!loading && !filtered.length && (
          <div className="p-8 text-center">
            <p className="font-medium">No leads match.</p>
            <p className="mt-1 text-sm text-[#5B6472]">Add your first lead or import a CSV to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-[#5B6472]">Loading leads…</p>}>
      <LeadsTable />
    </Suspense>
  );
}
