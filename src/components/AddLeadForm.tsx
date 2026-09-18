"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AddLeadForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", website: "", source: "", city: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setErr("");
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("leads").insert({
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      website: form.website.trim() || null,
      source: form.source || null,
      city: form.city || null,
      notes: form.notes || null,
      status: "New",
      created_by: user.user?.id ?? null,
    });
    setSaving(false);
    if (!error) {
      setForm({ name: "", phone: "", email: "", website: "", source: "", city: "", notes: "" });
      onDone();
    } else setErr(error.message);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="col-span-2 text-sm font-medium">Name *
        <input required placeholder="Full name" className="field mt-1" value={form.name} onChange={set("name")} />
      </label>
      <label className="text-sm font-medium">Phone
        <input placeholder="+91…" className="field mt-1" value={form.phone} onChange={set("phone")} />
      </label>
      <label className="text-sm font-medium">Email
        <input placeholder="name@mail.com" type="email" className="field mt-1" value={form.email} onChange={set("email")} />
      </label>
      <label className="text-sm font-medium">Website
        <input placeholder="https://company.com" type="url" inputMode="url" className="field mt-1" value={form.website} onChange={set("website")} />
      </label>
      <label className="text-sm font-medium">Source
        <input placeholder="e.g. IndiaMART, referral" className="field mt-1" value={form.source} onChange={set("source")} />
      </label>
      <label className="text-sm font-medium">City
        <input placeholder="Ahmedabad" className="field mt-1" value={form.city} onChange={set("city")} />
      </label>
      <label className="col-span-2 text-sm font-medium">Notes
        <textarea placeholder="Anything worth knowing…" className="field mt-1" rows={2} value={form.notes} onChange={set("notes")} />
      </label>
      {err && <p role="alert" className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <button disabled={saving} className="btn-primary col-span-2 py-2 disabled:opacity-50">
        {saving ? "Adding…" : "Add lead"}
      </button>
    </form>
  );
}
