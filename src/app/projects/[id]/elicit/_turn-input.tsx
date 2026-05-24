"use client";

import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { sendTurn } from "@/server/elicitation";

export function TurnInput({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    const clientRequestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    startTransition(async () => {
      setError(null);
      const result = await sendTurn({
        sessionId,
        clientRequestId,
        userMessage: trimmed,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setText("");
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
      <textarea
        name="message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={10000}
        placeholder="Escribe tu respuesta…"
        disabled={pending}
        className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Cmd/Ctrl + Enter envía. Tu respuesta se persiste antes de llamar al modelo.
        </p>
        <Button type="submit" disabled={pending || !text.trim()}>
          {pending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
