import type { ReactNode } from "react";
import { Bell, Command, LogOut, Menu, Plus, Search } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { AppSidebar } from "./app-sidebar";

interface WorkspaceShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}

export function WorkspaceShell({ title, subtitle, children, eyebrow = "LIRE Help workspace", actions }: WorkspaceShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <AppSidebar />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 lg:hidden"
                aria-label="Workspace navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                    Route-driven shell
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 min-[420px]:min-w-[280px]">
                  <Search className="h-4 w-4" />
                  <span className="flex-1">Search conversations, tickets, or customers</span>
                  <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
                    <Command className="inline h-3 w-3" />K
                  </span>
                </div>
                <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                  <Plus className="h-4 w-4" />
                  Quick create
                </button>
                <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50">
                  <Bell className="h-4 w-4" />
                </button>
                {actions}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="rounded-full bg-slate-900 px-2.5 py-1 font-medium text-slate-50">{user?.role ?? "staff"}</span>
                <span>{user?.name ?? user?.email}</span>
                <button onClick={logout} className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
