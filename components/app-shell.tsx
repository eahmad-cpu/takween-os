import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthButtons } from "@/components/auth-buttons";
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="grid grid-cols-[280px_1fr]">
        <aside className="min-h-dvh border-l bg-card/30 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">مزرعة الآخرة</div>
            <div className="flex items-center gap-2">
              <AuthButtons />
              <ThemeToggle />
            </div>
          </div>

          <nav className="mt-6 space-y-2 text-sm">
            <Link
              className="block rounded-md px-3 py-2 hover:bg-muted"
              href="/"
            >
              الرئيسية
            </Link>
            <Link
              className="block rounded-md px-3 py-2 hover:bg-muted"
              href="/ibadah"
            >
              الشريعة والإصلاح
            </Link>
            <Link
              className="block rounded-md px-3 py-2 hover:bg-muted"
              href="/explorer"
            >
              المستكشف
            </Link>
            <Link
              className="block rounded-md px-3 py-2 hover:bg-muted"
              href="/activity"
            >
              النشاط
            </Link>
            <Link
              className="block rounded-md px-3 py-2 hover:bg-muted"
              href="/settings"
            >
              الإعدادات
            </Link>
          </nav>
        </aside>
        <main className="min-h-dvh p-6">{children}</main>
      </div>
    </div>
  );
}
