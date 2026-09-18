"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { STATUSES, STATUS_DOT, STATUS_LABEL, type Lead, type Status } from "@/lib/types";

function Card({ lead, onMove }: { lead: Lead; onMove: (id: string, to: Status) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const overdue = lead.followup_date && lead.followup_date < new Date().toISOString().slice(0, 10);
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-[#E4E9F2] bg-white p-2.5 text-sm shadow-sm ${isDragging ? "opacity-60 shadow-lg" : ""}`}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...listeners}
          {...attributes}
          aria-label={`Drag ${lead.name}`}
          title="Drag to move"
          className="mt-0.5 cursor-grab touch-none rounded px-1 text-[#5B6472] hover:bg-[#F4F6FA] hover:text-[#298DFF] active:cursor-grabbing"
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/dashboard/leads/${lead.id}`} className="block truncate font-medium text-[#0B0E13] hover:text-[#298DFF] hover:underline">
            {lead.name}
          </Link>
          <div className="font-mono text-xs text-[#5B6472]">{lead.phone}</div>
          {lead.followup_date && (
            <div className={`mt-1 font-mono text-xs ${overdue ? "font-semibold text-red-600" : "text-[#5B6472]"}`}>
              {overdue ? "● " : "○ "}{lead.followup_date}
            </div>
          )}
          <select
            aria-label={`Move ${lead.name} to stage`}
            className="mt-1.5 w-full rounded border border-[#E4E9F2] bg-[#F4F6FA] px-1 py-0.5 text-xs"
            value={lead.status}
            onChange={(e) => onMove(lead.id, e.target.value as Status)}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function Column({ status, leads, onMove }: { status: Status; leads: Lead[]; onMove: (id: string, to: Status) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section aria-label={`${STATUS_LABEL[status]} lane`} ref={setNodeRef} className={`w-[82vw] max-w-80 shrink-0 rounded-xl border border-[#E4E9F2] p-2 sm:w-64 ${isOver ? "bg-[#E3EFFF]" : "bg-white"}`}>
      <header className={`rounded-t-lg border-t-4 px-1 pb-1 pt-2 ${STATUS_DOT[status].replace("bg-", "border-")}`}>
        <h2 className="flex items-center gap-1.5 px-1 text-sm font-semibold">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          {STATUS_LABEL[status]}
          <span className="ml-auto rounded-full bg-[#F4F6FA] px-2 py-0.5 text-xs text-[#5B6472]">{leads.length}</span>
        </h2>
      </header>
      <div className="min-h-24 space-y-2 p-1">
        {leads.map((l) => <Card key={l.id} lead={l} onMove={onMove} />)}
        {!leads.length && <p className="rounded-lg border border-dashed border-[#E4E9F2] p-3 text-center text-xs text-[#5B6472]">Drop leads here</p>}
      </div>
    </section>
  );
}

export default function KanbanPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [capped, setCapped] = useState(false);

  async function load() {
    const supabase = createClient();
    // lean columns only; capped — kanban is a working view, not an archive
    const { data } = await supabase
      .from("leads")
      .select("id,name,phone,status,followup_date")
      .order("created_at", { ascending: false })
      .limit(500);
    setLeads((data as Lead[]) ?? []);
    setCapped((data?.length ?? 0) >= 500);
    setLoading(false);
  }
  // fetch-on-mount from Supabase (external system sync)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function move(id: string, to: Status) {
    const cur = leads.find((l) => l.id === id);
    if (!cur || cur.status === to) return;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: to } : l))); // optimistic
    const supabase = createClient();
    const { error } = await supabase.from("leads").update({ status: to }).eq("id", id);
    if (error) load();
    else supabase.from("lead_activities").insert({ lead_id: id, type: "status", body: `Moved to ${STATUS_LABEL[to]}.` });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || !active) return;
    move(active.id as string, over.id as Status);
  }

  return (
    <div className="space-y-4">
      <div className="mr-auto">
        <h1 className="font-display text-2xl font-bold text-[#0B0E13]">Kanban</h1>
        <p className="text-sm text-[#5B6472]">Drag cards by the handle, or use the stage dropdown on any card.</p>
        {capped && (
          <p className="rounded-lg border border-[#BFDBFE] bg-[#E3EFFF] px-3 py-2 text-sm">
            Showing the 500 most recent leads. Use Leads filters for older ones.
          </p>
        )}
      </div>
      {loading ? (
        <div className="flex gap-3 overflow-auto pb-4" aria-label="Loading board">
          {STATUSES.map((s) => (
            <div key={s} className="w-[82vw] max-w-80 shrink-0 animate-pulse rounded-xl border border-[#E4E9F2] bg-white p-2 sm:w-64">
              <div className="h-5 w-24 rounded bg-[#EEF2F7]" />
              <div className="mt-2 space-y-2">
                <div className="h-16 rounded-lg bg-[#F4F6FA]" />
                <div className="h-16 rounded-lg bg-[#F4F6FA]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DndContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-auto pb-4">
            {STATUSES.map((s) => (
              <Column key={s} status={s} leads={leads.filter((l) => l.status === s)} onMove={move} />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}
