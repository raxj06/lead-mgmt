"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { STATUSES, STATUS_DOT, STATUS_LABEL, type Status } from "@/lib/types";

const LINKS = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/leads", label: "Leads", exact: false },
  { href: "/dashboard/kanban", label: "Kanban", exact: false },
];

export default function SideNav({ email, onNavigate }: { email: string; onNavigate?: () => void }) {
  const path = usePathname();
  const active = (href: string, exact: boolean) =>
    exact ? path === href : path === href || path.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-2 py-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#298DFF] font-display text-lg font-bold text-white">B</span>
        <span className="font-display text-base font-bold text-white">Boostify CRM</span>
      </Link>

      <nav className="mt-6 space-y-1" aria-label="Primary">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active(l.href, l.exact) ? "page" : undefined}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active(l.href, l.exact)
                ? "bg-[#298DFF]/15 text-white shadow-[inset_2px_0_0_#298DFF]"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 px-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Pipeline</p>
        <ul className="mt-2 space-y-1.5">
          {STATUSES.map((s: Status) => (
            <li key={s} className="flex items-center gap-2 text-xs text-white/60">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
              {STATUS_LABEL[s]}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-white/10 pt-4">
        <p className="truncate px-1 text-xs text-white/60">{email}</p>
        <form action="/auth/signout" method="post" className="mt-2">
          <button className="w-full rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:border-[#298DFF] hover:text-white">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
