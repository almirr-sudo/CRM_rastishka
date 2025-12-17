import Link from "next/link";
import { UserPlus, Users, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/server";

export default async function AdminHomePage() {
  await requireRole(["admin"]);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Панель администратора</h1>
        <p className="text-sm text-muted-foreground">
          Управление пользователями, детьми и назначениями.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="grid gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-muted-foreground" />
              Пользователи
            </div>
            <Button asChild variant="secondary" className="h-10 justify-start">
              <Link href="/app/admin/users">
                <UserPlus className="size-4" />
                Пригласить / список
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UsersRound className="size-4 text-muted-foreground" />
              Дети
            </div>
            <Button asChild variant="secondary" className="h-10 justify-start">
              <Link href="/app/admin/children">
                <UsersRound className="size-4" />
                Список / добавить
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UsersRound className="size-4 text-muted-foreground" />
              Назначения
            </div>
            <Button asChild variant="secondary" className="h-10 justify-start">
              <Link href="/app/admin/assignments">
                <UsersRound className="size-4" />
                Терапевты ↔ дети
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

