import type { ReactNode } from "react";
import { Bell, Command, LogOut, Menu, Plus, Search } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { AppSidebar } from "./app-sidebar";

interface WorkspaceShellProps {
  title: string;
  children: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}

export function WorkspaceShell({ title, children, eyebrow = "Support workspace", actions }: WorkspaceShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-transparent text-slate-900">
      <AppSidebar />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/85 px-4 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm lg:hidden"
                aria-label="Workspace navigation"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
                <h1 className="mt-2 text-[clamp(1.8rem,3vw,2.4rem)] font-semibold tracking-[-0.045em] text-slate-950">{title}</h1>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-500 shadow-sm min-[420px]:min-w-[300px]">
                  <Search className="h-4 w-4" />
                  <span className="flex-1">Search conversations, tickets, or customers</span>
                  <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-400 shadow-sm">
                    <Command className="inline h-3 w-3" />K
                  </span>
                </div>
                <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                  <Plus className="h-4 w-4" />
                  Create
                </button>
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50">
                  <Bell className="h-4 w-4" />
                </button>
                {actions}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium capitalize text-slate-700">
                  {user?.role ?? "staff"}
                </span>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                  {user?.name ?? user?.email}
                </div>
                <button onClick={logout} className="inline-flex items-center gap-1.5 font-medium text-slate-600 transition hover:text-slate-900">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
