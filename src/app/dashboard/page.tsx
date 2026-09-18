import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUSES, STATUS_DOT, STATUS_LABEL } from "@/lib/types";

export default async function DashboardHome() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // counts only — no row data transferred
  const counts = await Promise.all(
    STATUSES.map((s) =>
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", s)
    )
  );
  const byStatus = Object.fromEntries(STATUSES.map((s, i) => [s, counts[i].count ?? 0]));
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  // only rows that actually need display
  const [{ data: overdue }, { data: dueToday }] = await Promise.all([
    supabase
      .from("leads")
      .select("id,name,phone,followup_date")
      .lt("followup_date", today)
      .not("status", "in", "(Converted,Lost)")
      .order("followup_date", { ascending: true })
      .limit(10),
    supabase
      .from("leads")
      .select("id,name,phone")
      .eq("followup_date", today)
      .not("status", "in", "(Converted,Lost)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const active = total - (byStatus["Converted"] ?? 0) - (byStatus["Lost"] ?? 0);
  const converted = byStatus["Converted"] ?? 0;
  const rate = total ? Math.round((converted / total) * 100) : 0;
  const overdueList = overdue ?? [];
  const dueList = dueToday ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
        <div className="mr-auto">
          <h1 className="font-display text-2xl font-bold text-[#0B0E13]">Overview</h1>
          <p className="text-sm text-[#5B6472]">
            {total} leads · {active} active · {rate}% converted
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link href="/dashboard/leads" className="btn-primary text-center">Manage leads</Link>
          <Link href="/dashboard/kanban" className="btn-ghost text-center">Open kanban</Link>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pipeline progress</h2>
          <span className="text-xs text-[#5B6472]">{converted} of {total} converted</span>
        </div>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-[#EEF2F7]" aria-hidden="true">
          {STATUSES.map((s) => (
            <span key={s} className={`${STATUS_DOT[s]} h-full`} style={{ width: `${total ? (byStatus[s] / total) * 100 : 0}%` }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-[#5B6472]">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
              {STATUS_LABEL[s]} · {byStatus[s] ?? 0}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((s) => (
          <Link key={s} href={`/dashboard/leads?status=${s}`} className="card p-3 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#5B6472]">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
              {STATUS_LABEL[s]}
            </div>
            <div className="font-display mt-1 text-2xl font-bold text-[#0B0E13]">{byStatus[s] ?? 0}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Follow-ups overdue ({overdueList.length})</h2>
            {overdueList.length >= 10 && (
              <Link href="/dashboard/leads" className="text-xs text-[#298DFF] hover:underline">View all</Link>
            )}
          </div>
          {overdueList.map((l) => (
            <Link key={l.id} href={`/dashboard/leads/${l.id}`} className="block border-b py-1.5 text-sm last:border-0 hover:text-[#298DFF]">
              {l.name} <span className="text-[#5B6472]">· {l.phone}</span> ·{" "}
              <span className="font-medium text-red-600">● {l.followup_date}</span>
            </Link>
          ))}
          {!overdueList.length && <p className="text-sm text-[#5B6472]">Nothing overdue. Nice.</p>}
        </div>
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Due today ({dueList.length})</h2>
            {dueList.length >= 10 && (
              <Link href="/dashboard/leads" className="text-xs text-[#298DFF] hover:underline">View all</Link>
            )}
          </div>
          {dueList.map((l) => (
            <Link key={l.id} href={`/dashboard/leads/${l.id}`} className="block border-b py-1.5 text-sm last:border-0 hover:text-[#298DFF]">
              {l.name} <span className="text-[#5B6472]">· {l.phone}</span>
            </Link>
          ))}
          {!dueList.length && (
            <p className="text-sm text-[#5B6472]">
              Nothing due today. <Link href="/dashboard/leads" className="text-[#298DFF] hover:underline">Pick up a lead →</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
