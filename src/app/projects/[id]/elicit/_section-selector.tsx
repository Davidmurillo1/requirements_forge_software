"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { SECTION_ORDER, SECTION_TITLES } from "@/lib/ai/prompts/sections";
import type { Database } from "@/lib/db/types";
import { jumpToSection } from "@/server/elicitation";

type Section = Database["public"]["Enums"]["elicitation_section"];
type SectionStatus = Database["public"]["Enums"]["section_status"];

const STATUS_BADGE: Record<SectionStatus, string> = {
  not_started: "·",
  in_progress: "…",
  incomplete: "!",
  complete: "✓",
};

export function SectionSelector({
  sessionId,
  currentSection,
  progress,
}: {
  sessionId: string;
  currentSection: Section;
  progress: Record<string, { status: SectionStatus; completion_score: number }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const section = e.target.value as Section;
    if (section === currentSection) return;
    startTransition(async () => {
      const result = await jumpToSection({ sessionId, section });
      if (!result.ok) {
        toast.error("No se pudo saltar de sección", { description: result.error.message });
        return;
      }
      toast.success(`Sección activa: ${SECTION_TITLES[section]}`);
      router.refresh();
    });
  }

  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Saltar a:</span>
      <select
        value={currentSection}
        onChange={onChange}
        disabled={pending}
        className="rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm disabled:opacity-60"
      >
        {SECTION_ORDER.map((s) => {
          const p = progress[s];
          const badge = p ? STATUS_BADGE[p.status] : STATUS_BADGE.not_started;
          return (
            <option key={s} value={s}>
              {badge} {SECTION_TITLES[s]}
            </option>
          );
        })}
      </select>
    </label>
  );
}
