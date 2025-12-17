"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { HomeNote, Profile, UserRole } from "@/types/models";

type HomeNoteWithAuthor = HomeNote & { author?: Pick<Profile, "full_name" | "role"> | null };

type EmbeddedAuthor = Pick<Profile, "full_name" | "role">;

function normalizeAuthor(raw: unknown): EmbeddedAuthor | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (
      first &&
      typeof first === "object" &&
      "full_name" in first &&
      "role" in first
    ) {
      return first as EmbeddedAuthor;
    }
    return null;
  }

  if (typeof raw === "object" && "full_name" in raw && "role" in raw) {
    return raw as EmbeddedAuthor;
  }

  return null;
}

function roleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "Администратор";
    case "therapist":
      return "Терапевт";
    case "parent":
      return "Родитель";
    default:
      return "Пользователь";
  }
}

function dateTimeRu(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const DEMO_NOTES: Array<Omit<HomeNoteWithAuthor, "child_id">> = [
  {
    id: "demo-note-1",
    author_id: "demo-parent",
    message: "Доброе утро! Ночь прошла спокойно. Настроение хорошее.",
    created_at: "2025-12-17T06:40:00.000Z",
    updated_at: "2025-12-17T06:40:00.000Z",
    author: { full_name: "Родитель", role: "parent" },
  },
  {
    id: "demo-note-2",
    author_id: "demo-therapist",
    message: "Спасибо! Сегодня будем наблюдать за реакцией на новые упражнения.",
    created_at: "2025-12-17T07:05:00.000Z",
    updated_at: "2025-12-17T07:05:00.000Z",
    author: { full_name: "Терапевт", role: "therapist" },
  },
];

async function fetchHomeNotes(childId: string): Promise<HomeNoteWithAuthor[]> {
  if (!supabase) return DEMO_NOTES.map((n) => ({ ...n, child_id: childId }));

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return [];

  const { data, error } = await supabase
    .from("home_notes")
    .select("id,child_id,author_id,message,created_at,updated_at,author:profiles(full_name,role)")
    .eq("child_id", childId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as Array<HomeNote & { author?: unknown }>;
  return rows.map((r) => ({ ...r, author: normalizeAuthor(r.author) }));
}

async function sendHomeNote(input: {
  childId: string;
  message: string;
  myRole: UserRole;
}): Promise<HomeNoteWithAuthor> {
  const nowIso = new Date().toISOString();

  if (!supabase) {
    return {
      id: crypto.randomUUID(),
      child_id: input.childId,
      author_id: "demo-me",
      message: input.message,
      created_at: nowIso,
      updated_at: nowIso,
      author: { full_name: "Вы", role: input.myRole },
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("Нет активной сессии");

  const { data, error } = await supabase
    .from("home_notes")
    .insert({
      child_id: input.childId,
      author_id: sessionData.session.user.id,
      message: input.message,
    })
    .select("id,child_id,author_id,message,created_at,updated_at,author:profiles(full_name,role)")
    .single();

  if (error) throw error;
  const row = data as HomeNote & { author?: unknown };
  return { ...row, author: normalizeAuthor(row.author) };
}

export function HomeNotesThread({
  childId,
  myRole = "parent",
  className,
}: {
  childId: string;
  myRole?: UserRole;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLDivElement | null>(null);

  const [draft, setDraft] = useState("");
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setMyUserId(data.user?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const notesQuery = useQuery({
    queryKey: ["homeNotes", childId],
    queryFn: () => fetchHomeNotes(childId),
    refetchInterval: supabase ? 15000 : false,
  });

  const items = notesQuery.data ?? [];

  const sendMutation = useMutation({
    mutationFn: (message: string) => sendHomeNote({ childId, message, myRole }),
    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: ["homeNotes", childId] });
      const prev = queryClient.getQueryData<HomeNoteWithAuthor[]>(["homeNotes", childId]) ?? [];

      const optimistic: HomeNoteWithAuthor = {
        id: `optimistic-${crypto.randomUUID()}`,
        child_id: childId,
        author_id: myUserId ?? "optimistic",
        message,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: { full_name: "Вы", role: myRole },
      };

      queryClient.setQueryData<HomeNoteWithAuthor[]>(["homeNotes", childId], [...prev, optimistic]);
      setDraft("");
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["homeNotes", childId], ctx.prev);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["homeNotes", childId] });
    },
  });

  const canSend = draft.trim().length > 0 && !sendMutation.isPending;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length]);

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquareText className="size-4 text-muted-foreground" />
        Домашние заметки
      </div>
      <Separator />

      <div
        ref={listRef}
        className="max-h-80 overflow-auto rounded-xl border bg-background p-3"
      >
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {notesQuery.isLoading ? "Загрузка сообщений…" : "Пока нет сообщений."}
          </div>
        ) : (
          <div className="grid gap-2">
            {items.map((n) => {
              const mine = Boolean(myUserId && n.author_id === myUserId) || n.author?.full_name === "Вы";
              const authorName = mine ? "Вы" : n.author?.full_name || "Участник";
              const authorRole = n.author?.role ?? "parent";
              return (
                <div key={n.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-xs",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-1 text-[11px] opacity-80",
                        mine ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {authorName} · {roleLabel(authorRole)}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{n.message}</div>
                    <div
                      className={cn(
                        "mt-1 text-[11px] opacity-70",
                        mine ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {dateTimeRu(n.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Напишите сообщение…"
          className="min-h-16"
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            className="h-11"
            disabled={!canSend}
            onClick={() => sendMutation.mutate(draft.trim())}
          >
            <SendHorizontal className="size-4" />
            Отправить
          </Button>
        </div>
        {sendMutation.isError ? (
          <div className="text-xs text-destructive">
            Не удалось отправить сообщение. Проверьте подключение и повторите попытку.
          </div>
        ) : null}
      </div>
    </div>
  );
}
