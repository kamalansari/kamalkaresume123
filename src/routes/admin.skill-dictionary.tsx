import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Save, RotateCcw, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  skillDictStore,
  DEFAULT_HARD_SKILL_PHRASES,
  DEFAULT_HARD_SKILL_SINGLES,
  SKILL_DICT_EVENT,
} from "@/lib/skillDictionaryStore";

export const Route = createFileRoute("/admin/skill-dictionary")({
  head: () => ({
    meta: [
      { title: "Skill Dictionary Admin — ResumeForge" },
      { name: "description", content: "Edit the hard-skill keyword dictionary used by the ATS scorer." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SkillDictionaryAdmin,
});

const toText = (arr: string[]) => arr.join("\n");
const fromText = (txt: string) =>
  txt.split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean);

function SkillDictionaryAdmin() {
  const [phrasesText, setPhrasesText] = useState("");
  const [singlesText, setSinglesText] = useState("");
  const [filter, setFilter] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Load current dictionary on mount.
  useEffect(() => {
    setPhrasesText(toText(skillDictStore.getPhrases()));
    setSinglesText(toText(skillDictStore.getSingles()));
  }, []);

  const phrases = useMemo(() => fromText(phrasesText), [phrasesText]);
  const singles = useMemo(() => fromText(singlesText), [singlesText]);

  const dedupedPhrases = useMemo(() => Array.from(new Set(phrases)), [phrases]);
  const dedupedSingles = useMemo(() => Array.from(new Set(singles)), [singles]);
  const phraseDupes = phrases.length - dedupedPhrases.length;
  const singleDupes = singles.length - dedupedSingles.length;

  const filteredPhrases = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return dedupedPhrases;
    return dedupedPhrases.filter((p) => p.includes(q));
  }, [filter, dedupedPhrases]);
  const filteredSingles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return dedupedSingles;
    return dedupedSingles.filter((p) => p.includes(q));
  }, [filter, dedupedSingles]);

  const dirty = useMemo(() => {
    const cur = {
      p: skillDictStore.getPhrases().join("\n"),
      s: skillDictStore.getSingles().join("\n"),
    };
    return cur.p !== dedupedPhrases.join("\n") || cur.s !== dedupedSingles.join("\n");
  }, [dedupedPhrases, dedupedSingles, savedAt]);

  const saveAndApply = () => {
    skillDictStore.save(dedupedPhrases, dedupedSingles);
    setSavedAt(Date.now());
    toast.success(
      `Dictionary saved — ${dedupedPhrases.length} phrases, ${dedupedSingles.length} singles. ATS scores will refresh.`,
    );
    // Nudge other tabs/components that listen to storage events too.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new StorageEvent("storage", { key: "resumeforge.skillDict.phrases.v1" }));
    }
  };

  const resetDefaults = () => {
    if (!confirm("Reset both lists to the built-in defaults? Your custom entries will be lost.")) return;
    skillDictStore.reset();
    setPhrasesText(toText(DEFAULT_HARD_SKILL_PHRASES));
    setSinglesText(toText(DEFAULT_HARD_SKILL_SINGLES));
    setSavedAt(Date.now());
    toast.success("Restored built-in dictionary defaults.");
  };

  const loadDefaultsIntoEditor = () => {
    setPhrasesText(toText(DEFAULT_HARD_SKILL_PHRASES));
    setSinglesText(toText(DEFAULT_HARD_SKILL_SINGLES));
    toast.info("Defaults loaded into editor — click Save & Apply to commit.");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpen className="h-6 w-6 text-primary" />
            Skill Dictionary
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Controls which keywords the ATS scorer extracts from a job description. Multi-word
            phrases are matched first, then single tokens from the allowlist. One entry per line,
            lowercase. Changes apply instantly to every ATS view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDefaultsIntoEditor}>
            Load defaults
          </Button>
          <Button variant="outline" size="sm" onClick={resetDefaults}>
            <RotateCcw className="h-4 w-4" /> Reset to defaults
          </Button>
          <Button size="sm" onClick={saveAndApply} disabled={!dirty}>
            <Save className="h-4 w-4" /> Save &amp; apply
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
        <span>
          <strong>{dedupedPhrases.length}</strong> phrases
          {phraseDupes > 0 && <span className="ml-1 text-amber-600">({phraseDupes} dupes)</span>}
        </span>
        <span>·</span>
        <span>
          <strong>{dedupedSingles.length}</strong> singles
          {singleDupes > 0 && <span className="ml-1 text-amber-600">({singleDupes} dupes)</span>}
        </span>
        <span>·</span>
        <span className={dirty ? "text-amber-600" : "text-emerald-600"}>
          {dirty ? "Unsaved changes" : "Saved"}
        </span>
        <div className="ml-auto">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter preview…"
            className="rounded-md border bg-background px-2 py-1 text-xs"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Multi-word phrases</h2>
            <span className="text-xs text-muted-foreground">e.g. <code>power bi</code>, <code>data warehousing</code></span>
          </div>
          <Textarea
            value={phrasesText}
            onChange={(e) => setPhrasesText(e.target.value)}
            spellCheck={false}
            className="min-h-[420px] font-mono text-xs"
          />
          <PreviewChips items={filteredPhrases} />
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Single-word skills</h2>
            <span className="text-xs text-muted-foreground">e.g. <code>sql</code>, <code>python</code>, <code>etl</code></span>
          </div>
          <Textarea
            value={singlesText}
            onChange={(e) => setSinglesText(e.target.value)}
            spellCheck={false}
            className="min-h-[420px] font-mono text-xs"
          />
          <PreviewChips items={filteredSingles} />
        </section>
      </div>
    </div>
  );
}

function PreviewChips({ items }: { items: string[] }) {
  if (!items.length) {
    return <p className="mt-3 text-xs text-muted-foreground">No matching entries.</p>;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {items.slice(0, 200).map((it) => (
        <span
          key={it}
          className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
        >
          {it}
        </span>
      ))}
      {items.length > 200 && (
        <span className="text-[11px] text-muted-foreground">+{items.length - 200} more…</span>
      )}
    </div>
  );
}