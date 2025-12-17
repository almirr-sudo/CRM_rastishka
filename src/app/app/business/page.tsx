import Link from "next/link";
import { CalendarDays, CreditCard, Settings2, UsersRound } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tile = { href: string; title: string; description: string; icon: React.ReactNode };

const tiles: Tile[] = [
  {
    href: "/app/business/calendar",
    title: "Календарь",
    description: "Запись на занятия, переносы и статусы.",
    icon: <CalendarDays className="size-5 text-muted-foreground" />,
  },
  {
    href: "/app/business/services",
    title: "Услуги",
    description: "Каталог услуг, длительность и цены.",
    icon: <Settings2 className="size-5 text-muted-foreground" />,
  },
  {
    href: "/app/business/specialists",
    title: "Расписание специалистов",
    description: "Рабочие часы терапевтов по дням недели.",
    icon: <UsersRound className="size-5 text-muted-foreground" />,
  },
  {
    href: "/app/business/finance",
    title: "Финансы",
    description: "Баланс, начисления и платежи.",
    icon: <CreditCard className="size-5 text-muted-foreground" />,
  },
];

export default function BusinessHomePage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Бизнес‑модуль</h1>
        <p className="text-sm text-muted-foreground">
          Управление расписанием, услугами и финансами.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-xl outline-none",
              "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <Card className="h-full transition-shadow hover:shadow-sm">
              <CardContent className="grid gap-2 p-4">
                <div className="flex items-center gap-2">
                  {t.icon}
                  <div className="text-sm font-semibold">{t.title}</div>
                </div>
                <div className="text-sm text-muted-foreground">{t.description}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

