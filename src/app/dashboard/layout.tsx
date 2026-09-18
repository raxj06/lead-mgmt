import { redirect } from "next/navigation";
import { headers } from "next/headers";
import SideNav from "@/components/SideNav";
import MobileNav from "@/components/MobileNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // auth gate lives in proxy.ts; email is forwarded via header (single getUser per navigation)
  const email = (await headers()).get("x-user-email");
  if (!email) redirect("/login");
  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[#F4F6FA] text-[#0B0E13] lg:flex">
      <aside className="hidden w-60 shrink-0 bg-[#0B0E13] p-4 lg:block">
        <div className="sticky top-4 h-[calc(100vh-2rem)]">
          <SideNav email={email} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-[#E4E9F2] bg-white lg:hidden">
          <div className="flex min-w-0 items-center gap-2 px-3 py-2.5 sm:px-4">
            <MobileNav email={email} />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#298DFF] font-display text-sm font-bold text-white">B</span>
            <span className="truncate font-display text-sm font-bold">Boostify CRM</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
