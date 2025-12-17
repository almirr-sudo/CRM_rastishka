import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Страница не найдена</h1>
        <p className="text-muted-foreground">
          Проверьте адрес или вернитесь на главную страницу.
        </p>
        <Button asChild>
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}

