import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // derive origin from the request so redirects work on any domain (Vercel, localhost)
  return NextResponse.redirect(new URL("/login", req.url), 303);
}

// allow form POST without JS fetch redirect handling
export async function GET(req: NextRequest) {
  return POST(req);
}
