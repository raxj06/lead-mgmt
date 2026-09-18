export const STATUSES = ["New", "Assigned", "Called", "FollowUp", "Converted", "Lost"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  New: "New",
  Assigned: "Assigned",
  Called: "Called",
  FollowUp: "Follow-up",
  Converted: "Converted",
  Lost: "Lost",
};

export const STATUS_STYLES: Record<Status, string> = {
  New: "bg-[#EEF2F7] text-[#334155] border-[#D7DEE9]",
  Assigned: "bg-[#E3EFFF] text-[#1D6FF2] border-[#BFDBFE]",
  Called: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
  FollowUp: "bg-[#EDE9FE] text-[#5B21B6] border-[#DDD6FE]",
  Converted: "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]",
  Lost: "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]",
};

export const STATUS_DOT: Record<Status, string> = {
  New: "bg-[#64748B]",
  Assigned: "bg-[#298DFF]",
  Called: "bg-[#D97706]",
  FollowUp: "bg-[#7C3AED]",
  Converted: "bg-[#16A34A]",
  Lost: "bg-[#DC2626]",
};

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
}

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  source: string | null;
  city: string | null;
  status: Status;
  assigned_to: string | null;
  notes: string | null;
  followup_date: string | null;
  last_called_at: string | null;
  created_by: string | null;
  created_at: string;
  profiles?: Pick<Profile, "name" | "email"> | null;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: "called" | "note" | "status";
  body: string | null;
  created_at: string;
}
