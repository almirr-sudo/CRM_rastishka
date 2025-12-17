"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
        <p className="text-muted-foreground">
          Попробуйте обновить страницу или повторить действие.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" onClick={() => reset()}>
            Повторить
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            Обновить
          </Button>
        </div>
      </div>
    </div>
  );
}

