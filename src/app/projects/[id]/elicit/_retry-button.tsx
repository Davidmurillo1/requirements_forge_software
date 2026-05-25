"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { retryFailedTurn } from "@/server/elicitation";

export function RetryTurnButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await retryFailedTurn({ sessionId });
            if (!result.ok) {
              setError(result.error.message);
              toast.error("Reintento falló", { description: result.error.message });
              return;
            }
            toast.success("Reintento OK");
            router.refresh();
          })
        }
      >
        {pending ? "Reintentando…" : "Reintentar"}
      </Button>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
