"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Briefcase, LogOut, Menu, Shield, Stethoscope, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Profile, UserRole } from "@/types/models";
import { DEMO_NAME_COOKIE, DEMO_ROLE_COOKIE } from "@/lib/auth/demo";

type NavItem = { href: string; label: string };

function NavLinks({
  nav,
  pathname,
  onNavigate,
}: {
  nav: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="grid gap-1">
      {nav.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function roleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "Администратор";
    case "manager":
      return "Менеджер";
    case "therapist":
      return "Терапевт / педагог";
    case "parent":
      return "Родитель";
    default:
      return "Пользователь";
  }
}

function buildNav(role: UserRole): NavItem[] {
  const businessNav: NavItem[] = [
    { href: "/app/business/calendar", label: "Календарь" },
    { href: "/app/business/services", label: "Услуги" },
    { href: "/app/business/specialists", label: "Расписание специалистов" },
    { href: "/app/business/finance", label: "Финансы" },
  ];

  if (role === "admin") {
    return [
      { href: "/app/admin", label: "Панель администратора" },
      { href: "/app/admin/users", label: "Пользователи" },
      { href: "/app/admin/children", label: "Дети" },
      { href: "/app/admin/assignments", label: "Назначения" },
      ...businessNav,
    ];
  }

  if (role === "manager") {
    return businessNav;
  }

  if (role === "parent") {
    return [{ href: "/app/parent", label: "Портал родителя" }];
  }

  return [
    { href: "/app/therapist", label: "Быстрый ввод" },
    { href: "/app/therapist/notes", label: "Домашние заметки" },
    { href: "/app/therapist/incidents", label: "Инциденты (ABC)" },
    { href: "/app/therapist/abc-analysis", label: "ABC анализ" },
    { href: "/app/therapist/goals", label: "Цели и навыки" },
  ];
}

function roleIcon(role: UserRole) {
  if (role === "admin") return <Shield className="size-4 text-muted-foreground" />;
  if (role === "manager") return <Briefcase className="size-4 text-muted-foreground" />;
  if (role === "parent") return <Users className="size-4 text-muted-foreground" />;
  return <Stethoscope className="size-4 text-muted-foreground" />;
}

function clearCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0`;
}

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const nav = buildNav(profile.role);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      clearCookie(DEMO_ROLE_COOKIE);
      clearCookie(DEMO_NAME_COOKIE);
    }
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setNavOpen(true)}
              aria-label="Открыть меню"
            >
              <Menu />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">RAS CRM</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {roleIcon(profile.role)}
                <span className="truncate">
                  {profile.full_name || "Пользователь"} · {roleLabel(profile.role)}
                </span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="hidden h-10 sm:inline-flex"
            onClick={signOut}
          >
            <LogOut className="size-4" />
            Выйти
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-10 w-10 sm:hidden"
            onClick={signOut}
            aria-label="Выйти"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:grid-cols-[240px_1fr]">
        <aside className="hidden rounded-xl border bg-card p-3 md:block">
          <NavLinks nav={nav} pathname={pathname} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>

      <Drawer open={navOpen} onOpenChange={setNavOpen} direction="left">
        <DrawerContent className="h-full w-72 rounded-none border-r">
          <DrawerHeader>
            <DrawerTitle>Меню</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <NavLinks
              nav={nav}
              pathname={pathname}
              onNavigate={() => setNavOpen(false)}
            />
            <Separator className="my-4" />
            <Button type="button" variant="secondary" className="w-full" onClick={signOut}>
              <LogOut className="size-4" />
              Выйти
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
