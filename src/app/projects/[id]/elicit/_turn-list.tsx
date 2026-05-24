import type { Json, Database } from "@/lib/db/types";
import { RetryTurnButton } from "@/app/projects/[id]/elicit/_retry-button";

type Turn = {
  id: string;
  actor: Database["public"]["Enums"]["session_actor"];
  role: Database["public"]["Enums"]["turn_role"];
  section: Database["public"]["Enums"]["elicitation_section"];
  payload: Json;
  status: Database["public"]["Enums"]["turn_status"];
  error_code: string | null;
  created_at: string;
};

export function TurnList({ turns, sessionId }: { turns: Turn[]; sessionId: string }) {
  if (turns.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Aún no hay turnos. Cuando inicies, el motor formulará la primera pregunta.
      </p>
    );
  }

  return (
    <ol className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto p-4">
      {turns.map((t) => (
        <li key={t.id}>
          <TurnBubble turn={t} sessionId={sessionId} />
        </li>
      ))}
    </ol>
  );
}

function TurnBubble({ turn, sessionId }: { turn: Turn; sessionId: string }) {
  const isEngine = turn.actor === "engine";
  const isFailed = turn.status === "failed";
  const isMeta = turn.role === "meta";

  if (isMeta) {
    return (
      <div className="mx-auto max-w-md rounded-md border border-dashed bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
        {renderMetaText(turn)}
        {isFailed ? (
          <div className="mt-2">
            <RetryTurnButton sessionId={sessionId} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={
        isEngine
          ? "mr-12 rounded-lg border bg-muted/40 p-3 text-sm"
          : "ml-12 rounded-lg border bg-primary/5 p-3 text-sm"
      }
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {isEngine ? "Motor" : turn.actor === "consultant" ? "Consultor" : "Stakeholder"}
      </p>
      <p className="whitespace-pre-wrap leading-relaxed">{renderTurnText(turn)}</p>
      {isEngine ? <FollowupHints turn={turn} /> : null}
    </div>
  );
}

function FollowupHints({ turn }: { turn: Turn }) {
  const payload = turn.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const followups = (payload as { suggested_followups?: unknown }).suggested_followups;
  if (!Array.isArray(followups) || followups.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
      {followups.slice(0, 6).map((f, i) => (
        <li key={i}>· {String(f)}</li>
      ))}
    </ul>
  );
}

function renderTurnText(turn: Turn): string {
  const p = turn.payload;
  if (!p) return "(sin contenido)";
  if (typeof p === "string") return p;
  if (Array.isArray(p)) return JSON.stringify(p);
  if (typeof p === "object") {
    const obj = p as Record<string, unknown>;
    if (typeof obj.question === "string") return obj.question;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.message === "string") return obj.message;
    return JSON.stringify(obj);
  }
  return String(p);
}

function renderMetaText(turn: Turn): string {
  const p = turn.payload;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    const obj = p as Record<string, unknown>;
    if (obj.kind === "section_jump") {
      return `Salto: ${String(obj.from)} → ${String(obj.to)}`;
    }
    if (obj.kind === "engine_failure") {
      return `Fallo del modelo${turn.error_code ? ` (${turn.error_code})` : ""}: ${String(obj.errorMessage ?? "")}`;
    }
  }
  return turn.status === "failed" ? "Turno fallido" : "Evento del sistema";
}
