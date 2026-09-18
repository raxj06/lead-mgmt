import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // collect refreshed cookies; applied once to the final response below
  type CookieOptions = NonNullable<Parameters<NextResponse["cookies"]["set"]>[2]>;
  const refreshed: { name: string; value: string; options?: CookieOptions }[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          refreshed.push(...cookiesToSet);
        },
      },
    }
  );
  const { data } = await supabase.auth.getUser();
  const isAuth = !!data.user;
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isRoot = request.nextUrl.pathname === "/";
  if (!isAuth && !isLogin) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    refreshed.forEach(({ name, value, options }) =>
      redirect.cookies.set(name, value, options)
    );
    return redirect;
  }
  if (isAuth && (isLogin || isRoot)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  // forward the email so dashboard layout skips a second getUser() round trip
  const headers = new Headers(request.headers);
  if (isAuth && data.user?.email) headers.set("x-user-email", data.user.email);
  const response = NextResponse.next({ request: { headers } });
  refreshed.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
