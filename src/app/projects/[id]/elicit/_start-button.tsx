"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { startSession } from "@/server/elicitation";

export function StartSessionButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await startSession({ projectId });
            if (!result.ok) {
              setError(result.error.message);
            }
          })
        }
      >
        {pending ? "Iniciando…" : "Iniciar sesión"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
