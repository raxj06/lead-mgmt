"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STATUSES, STATUS_LABEL, STATUS_STYLES, type Lead, type Profile, type Status } from "@/lib/types";
import AddLeadForm from "@/components/AddLeadForm";

// xlsx (~800KB) loads only when the Import panel opens
const ImportLeads = dynamic(() => import("@/components/ImportLeads"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-[#5B6472]">Loading importer…</p>,
});

const PAGE_SIZE = 100;

// strip ilike metacharacters so search text can't break the .or() filter
const escLike = (s: string) => s.replace(/[%_\\(),]/g, "").trim();

function LeadsTable() {
  const params = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [statusF, setStatusF] = useState<string>(params.get("status") ?? "all");
  const [assigneeF, setAssigneeF] = useState<string>("all");
  const [cityF, setCityF] = useState<string>("all");
  const [webF, setWebF] = useState<string>("all");
  const [sel, setSel] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const lastIdx = useRef<number | null>(null);

  interface PageFilters {
    statusF: string;
    assigneeF: string;
    cityF: string;
    webF: string;
    qDeb: string;
    myId: string | null;
  }

  async function fetchPage(reset: boolean, offset: number, f: PageFilters) {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    const supabase = createClient();
    let query = supabase
      .from("leads")
      .select("*, profiles!leads_assigned_to_fkey(name,email)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (f.statusF !== "all") query = query.eq("status", f.statusF);
    if (f.assigneeF === "unassigned") query = query.is("assigned_to", null);
    else if (f.assigneeF === "mine" && f.myId) query = query.eq("assigned_to", f.myId);
    else if (f.assigneeF !== "all" && f.assigneeF !== "mine") query = query.eq("assigned_to", f.assigneeF);
    if (f.cityF === "none") query = query.is("city", null);
    else if (f.cityF !== "all") query = query.eq("city", f.cityF);
    if (f.webF === "has") query = query.not("website", "is", null);
    else if (f.webF === "missing") query = query.is("website", null);
    if (f.qDeb) {
      const n = `%${escLike(f.qDeb)}%`;
      query = query.or(`name.ilike.${n},phone.ilike.${n},email.ilike.${n}`);
    }
    const { data, count, error } = await query;
    if (error) setBanner({ kind: "err", text: error.message });
    else {
      const rows = (data as Lead[]) ?? [];
      setLeads((prev) => (reset ? rows : [...prev, ...rows]));
      setTotal(count ?? null);
      if (reset) setSel([]);
    }
    setLoading(false);
    setLoadingMore(false);
  }

  function currentFilters(): PageFilters {
    return { statusF, assigneeF, cityF, webF, qDeb, myId };
  }

  async function refreshStatic() {
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    setMyId(user.user?.id ?? null);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("profiles").select("id,name,email"),
      // city names only — tiny payload for the filter dropdown
      supabase.from("leads").select("city").limit(2000),
    ]);
    setProfiles((p as Profile[]) ?? []);
    setCities(
      Array.from(new Set(((c ?? []) as { city: string | null }[]).map((r) => (r.city ?? "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      )
    );
  }

  // initial load: user + dropdown data + first page
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- fetch-on-mount from Supabase; filter effect below owns updates */
  useEffect(() => {
    refreshStatic();
    fetchPage(true, 0, currentFilters());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // debounce search typing into a server query
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  // any filter change restarts from page one (skips the mount run above)
  const firstRun = useRef(true);
  /* eslint-disable react-hooks/exhaustive-deps -- filter-driven refetch owns currentFilters/fetchPage identity */
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    fetchPage(true, 0, currentFilters());
  }, [statusF, assigneeF, cityF, webF, qDeb, myId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const hasMore = total != null ? leads.length < total : false;

  function toggle(id: string, idx: number, e?: React.ChangeEvent<HTMLInputElement>) {
    const shift = (e?.nativeEvent as MouseEvent | undefined)?.shiftKey;
    if (shift && lastIdx.current !== null) {
      // shift-click: select whole range between last click and this one
      const [a, b] = [lastIdx.current, idx].sort((x, y) => x - y);
      const ids = leads.slice(a, b + 1).map((l) => l.id);
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
      fetchPage(true, 0, currentFilters());
    }
  }

  async function bulkUnassign() {
    if (!sel.length) return;
    const supabase = createClient();
    const { error } = await supabase.from("leads").update({ assigned_to: null }).in("id", sel);
    if (error) setBanner({ kind: "err", text: error.message });
    else {
      setBanner({ kind: "ok", text: `Unassigned ${sel.length} lead${sel.length > 1 ? "s" : ""}.` });
      fetchPage(true, 0, currentFilters());
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
      fetchPage(true, 0, currentFilters());
    }
  }

  const nameOf = (id: string | null) =>
    profiles.find((p) => p.id === id)?.name ?? profiles.find((p) => p.id === id)?.email ?? "—";

  function refreshAfterMutate() {
    fetchPage(true, 0, currentFilters());
    refreshStatic();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <div className="mr-auto">
          <h1 className="font-display text-2xl font-bold text-[#0B0E13]">
            Leads{total != null ? ` (${total})` : ""}
          </h1>
          <p className="text-sm text-[#5B6472]">Select leads to assign, or open one to call.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button onClick={() => { setShowAdd(!showAdd); setShowImport(false); }} className="btn-primary">+ Add lead</button>
          <button onClick={() => { setShowImport(!showImport); setShowAdd(false); }} className="btn-ghost">Import CSV/XLSX</button>
        </div>
      </div>

      {showAdd && <div className="card max-w-xl p-4"><AddLeadForm onDone={refreshAfterMutate} /></div>}
      {showImport && <div className="card max-w-xl p-4"><ImportLeads onDone={refreshAfterMutate} /></div>}

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
        <select aria-label="Filter by city" className="field w-full sm:w-auto" value={cityF} onChange={(e) => setCityF(e.target.value)}>
          <option value="all">All cities</option>
          <option value="none">No city</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Filter by website" className="field w-full sm:w-auto" value={webF} onChange={(e) => setWebF(e.target.value)}>
          <option value="all">With/without website</option>
          <option value="has">Has website</option>
          <option value="missing">No website</option>
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
          <input type="checkbox" aria-label="Select loaded leads" checked={leads.length > 0 && sel.length === leads.length} onChange={() => { setSel(sel.length === leads.length ? [] : leads.map((l) => l.id)); lastIdx.current = null; }} />
          <span className="text-[#5B6472]">
            {total != null ? `Showing ${leads.length} of ${total}` : `${leads.length} loaded`}
          </span>
          <span className="ml-auto hidden text-xs text-[#9AA3B2] sm:block">Tip: shift-click to select a range</span>
        </div>
        {loading ? (
          <ul className="divide-y divide-[#E4E9F2]" aria-label="Loading leads">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex animate-pulse gap-3 px-3 py-3">
                <span className="mt-1.5 h-10 w-10 rounded-full bg-[#EEF2F7]" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-2/3 rounded bg-[#EEF2F7]" />
                  <div className="h-3 w-1/3 rounded bg-[#F4F6FA]" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
        <ul className="divide-y divide-[#E4E9F2]">
          {leads.map((l, i) => (
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
        )}
        {loadingMore && <p className="p-4 text-center text-sm text-[#5B6472]">Loading more…</p>}
        {!loading && hasMore && (
          <button onClick={() => fetchPage(false, leads.length, currentFilters())} className="block w-full border-t border-[#E4E9F2] bg-[#F4F6FA] py-2.5 text-sm font-medium text-[#298DFF] hover:bg-[#E3EFFF]">
            Load more ({(total ?? 0) - leads.length} remaining)
          </button>
        )}
        {!loading && !leads.length && (
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
