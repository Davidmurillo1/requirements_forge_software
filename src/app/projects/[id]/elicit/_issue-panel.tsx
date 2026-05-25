"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/db/types";
import { resolveIssue } from "@/server/elicitation";

type Issue = {
  id: string;
  type: Database["public"]["Enums"]["issue_type"];
  severity: Database["public"]["Enums"]["issue_severity"];
  title: string;
  body: string;
  status: Database["public"]["Enums"]["issue_status"];
  created_at: string;
};

const TYPE_LABEL: Record<Database["public"]["Enums"]["issue_type"], string> = {
  vagueness: "Vaguedad",
  contradiction: "Contradicción",
  missing_cross_cutting: "Cross-cutting faltante",
  missing_metric: "Métrica faltante",
  undefined_glossary: "Término sin glosario",
};

const SEVERITY_STYLE: Record<Database["public"]["Enums"]["issue_severity"], string> = {
  info: "border-sky-300 bg-sky-50 dark:border-sky-700/40 dark:bg-sky-950/30",
  warning: "border-amber-300 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/30",
  error: "border-red-300 bg-red-50 dark:border-red-700/40 dark:bg-red-950/30",
};

export function IssuePanel({ issues }: { issues: Issue[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <header className="border-b px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Hallazgos abiertos
        </p>
        <p className="text-sm">
          {issues.length === 0
            ? "Sin hallazgos pendientes."
            : `${issues.length} pendiente${issues.length === 1 ? "" : "s"}`}
        </p>
      </header>
      <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
        {issues.map((i) => (
          <IssueCard key={i.id} issue={i} />
        ))}
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(action: "resolve" | "dismiss") {
    startTransition(async () => {
      setError(null);
      const result = await resolveIssue({ issueId: issue.id, action });
      if (!result.ok) {
        setError(result.error.message);
        toast.error(
          action === "resolve" ? "No se pudo resolver" : "No se pudo descartar",
          { description: result.error.message },
        );
        return;
      }
      toast.success(
        action === "resolve" ? "Hallazgo resuelto" : "Hallazgo descartado",
        { description: issue.title },
      );
      // revalidatePath del servidor no siempre re-renderiza un client
      // component automáticamente: forzamos refresh del RSC desde el cliente.
      router.refresh();
    });
  }

  return (
    <article
      className={`rounded-md border p-3 text-sm transition-opacity ${SEVERITY_STYLE[issue.severity]} ${pending ? "pointer-events-none opacity-50" : ""}`}
      aria-busy={pending}
    >
      <p className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{TYPE_LABEL[issue.type]}</span>
        <span>{issue.severity}</span>
      </p>
      <p className="font-medium">{issue.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{issue.body}</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => act("resolve")}>
          {pending ? "Procesando…" : "Resolver"}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("dismiss")}>
          Descartar
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </article>
  );
}
