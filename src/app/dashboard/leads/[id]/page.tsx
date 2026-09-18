"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STATUSES, STATUS_LABEL, STATUS_STYLES, type Activity, type Lead, type Profile, type Status } from "@/lib/types";

const ACT_DOT: Record<Activity["type"], string> = {
  called: "bg-[#16A34A]",
  note: "bg-[#298DFF]",
  status: "bg-[#7C3AED]",
};

function smartValue(v: string | null) {
  if (!v) return "—";
  const t = v.trim();
  const href = /^https?:\/\//i.test(t) ? t : /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(t) ? `https://${t}` : null;
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block break-all text-[#298DFF] hover:underline">
        {t}
      </a>
    );
  return v;
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [failed, setFailed] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [followup, setFollowup] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function load() {
    const supabase = createClient();
    const [{ data: l, error }, { data: p }, { data: a }] = await Promise.all([
      supabase.from("leads").select("*").eq("id", id).single(),
      supabase.from("profiles").select("id,name,email"),
      supabase.from("lead_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ]);
    if (error || !l) {
      setFailed(true);
      return;
    }
    setLead(l as Lead);
    setFollowup((l as Lead).followup_date ?? "");
    setProfiles((p as Profile[]) ?? []);
    setActivities((a as Activity[]) ?? []);
  }
  // fetch-on-mount from Supabase (external system sync)
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  async function log(type: Activity["type"], body: string | null) {
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("lead_activities").insert({ lead_id: id, type, body, created_by: user.user?.id ?? null });
  }

  async function markCalled() {
    if (!lead) return;
    setBusy(true);
    setBanner(null);
    const supabase = createClient();
    const { error } = await supabase.from("leads").update({ status: "Called", last_called_at: new Date().toISOString() }).eq("id", id);
    if (error) setBanner({ kind: "err", text: error.message });
    else {
      await log("called", callNotes || "Called — no notes added.");
      setCallNotes("");
      setBanner({ kind: "ok", text: "Call logged." });
      await load();
    }
    setBusy(false);
  }

  async function saveFollowup() {
    setBanner(null);
    const supabase = createClient();
    const patch: Partial<Lead> = {
      followup_date: followup || null,
      notes: callNotes || lead?.notes || null,
      status: followup ? ("FollowUp" as Status) : lead?.status,
    };
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) setBanner({ kind: "err", text: error.message });
    else {
      await log("note", `Follow-up set to ${followup || "cleared"}.${callNotes ? ` ${callNotes}` : ""}`.slice(0, 500));
      setCallNotes("");
      setBanner({ kind: "ok", text: "Follow-up saved." });
      load();
    }
  }

  async function changeStatus(s: Status) {
    const supabase = createClient();
    await supabase.from("leads").update({ status: s }).eq("id", id);
    await log("status", `Status changed to ${STATUS_LABEL[s]}.`);
    load();
  }

  async function assign(uid: string) {
    const supabase = createClient();
    await supabase.from("leads").update({ assigned_to: uid || null, status: uid ? "Assigned" : lead?.status }).eq("id", id);
    await log("status", uid ? "Lead assigned." : "Lead unassigned.");
    load();
  }

  async function remove() {
    if (!confirm(`Delete ${lead?.name}? This cannot be undone.`)) return;
    const supabase = createClient();
    await supabase.from("leads").delete().eq("id", id);
    router.push("/dashboard/leads");
  }

  if (failed)
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-bold">Lead not found</h1>
        <p className="mt-1 text-sm text-[#5B6472]">It may have been deleted.</p>
        <Link href="/dashboard/leads" className="btn-primary mt-4 inline-block">Back to leads</Link>
      </div>
    );
  if (!lead) return <p className="text-sm text-[#5B6472]">Loading lead…</p>;

  return (
    <div className="min-w-0 max-w-4xl space-y-4">
      <Link href="/dashboard/leads" className="text-sm text-[#298DFF] hover:underline">← Back to leads</Link>

      {banner && (
        <p role={banner.kind === "err" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${banner.kind === "err" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {banner.text}
        </p>
      )}

      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="card min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display mr-auto min-w-0 break-words text-2xl font-bold">{lead.name}</h1>
              <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[lead.status]}`}>
                {STATUS_LABEL[lead.status]}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm min-[420px]:grid-cols-2">
              <div className="min-w-0"><dt className="text-xs text-[#5B6472]">Phone</dt><dd className="break-all font-mono text-[13px]">{lead.phone ?? "—"}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-[#5B6472]">Email</dt><dd className="break-all">{smartValue(lead.email)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-[#5B6472]">Website</dt><dd className="break-all">{smartValue(lead.website)}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-[#5B6472]">City</dt><dd className="break-all">{lead.city ?? "—"}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-[#5B6472]">Source</dt><dd className="break-all">{smartValue(lead.source)}</dd></div>
            </dl>
            {lead.notes && (
              <p className="mt-3 break-words rounded-lg bg-[#F4F6FA] p-3 text-sm">{lead.notes}</p>
            )}
            {lead.last_called_at && (
              <p className="mt-2 text-xs text-[#5B6472]">Last called: {new Date(lead.last_called_at).toLocaleString()}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="text-xs text-[#5B6472]">Status
                <select className="field mt-1 w-full min-w-0 sm:w-auto" value={lead.status} onChange={(e) => changeStatus(e.target.value as Status)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </label>
              <label className="text-xs text-[#5B6472]">Assignee
                <select className="field mt-1 w-full min-w-0 sm:w-auto" value={lead.assigned_to ?? ""} onChange={(e) => assign(e.target.value)}>
                  <option value="">Unassigned</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.name ?? p.email}</option>)}
                </select>
              </label>
              <button onClick={remove} className="self-end text-sm text-red-600 hover:underline sm:ml-auto">Delete lead</button>
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <h2 className="font-display font-bold">History</h2>
            {!activities.length && <p className="mt-2 text-sm text-[#5B6472]">No activity yet — log the first call.</p>}
            <ol className="mt-3 space-y-0">
              {activities.map((a) => (
                <li key={a.id} className="relative border-l-2 border-[#E4E9F2] pb-4 pl-4 last:pb-0">
                  <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white ${ACT_DOT[a.type]}`} />
                  <p className="break-words text-sm">
                    <span className="mr-2 rounded border border-[#E4E9F2] bg-[#F4F6FA] px-1.5 py-0.5 text-[11px] font-medium capitalize">{a.type}</span>
                    {a.body}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5B6472]">{new Date(a.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-4 md:sticky md:top-4 md:self-start">
          <div className="card border-t-4 border-t-[#298DFF] p-4">
            <h2 className="font-display font-bold">Log a call</h2>
            <label className="mt-2 block text-sm font-medium">Call notes
              <textarea
                placeholder="What did they say? Interested, asked for pricing…"
                className="field mt-1"
                rows={4}
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
              />
            </label>
            <button disabled={busy} onClick={markCalled} className="btn-primary mt-2 w-full disabled:opacity-50">
              {busy ? "Saving…" : "✓ Mark as called"}
            </button>
          </div>
          <div className="card p-4">
            <h2 className="font-display font-bold">Follow-up</h2>
            <label className="mt-2 block text-sm font-medium">Follow-up date
              <input type="date" className="field mt-1" value={followup} onChange={(e) => setFollowup(e.target.value)} />
            </label>
            <button onClick={saveFollowup} className="btn-dark mt-2 w-full">Save follow-up</button>
          </div>
        </div>
      </div>
    </div>
  );
}
