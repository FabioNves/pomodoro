"use client";

// Project creation flow: details → (scratch | template | AI) → review →
// create. The review screen is the same component the AI suggestions use,
// so templates and AI output are edited the same way before anything exists.

import React, { useEffect, useMemo, useState } from "react";
import ModalShell from "@/components/planner/ModalShell";
import StructureReview, {
  countSelected,
  makeMilestoneDraft,
  selectedMilestones,
} from "@/components/planner/StructureReview";
import { IconSparkle } from "@/components/planner/MilestoneBits";
import { AiUnavailable } from "@/components/planner/SuggestDialog";
import { PROJECT_COLORS } from "@/lib/projectColors";
import { PROJECT_TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/projectTemplates";
import { apiJson, isSignedIn } from "@/lib/plannerApi";
import { isInvalidRange } from "@/lib/milestones";

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none focus:ring-2 focus:ring-focus/40";

function ChoiceCard({ icon, title, text, onClick, disabled, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-left rounded-xl border border-edge bg-surface-2/60 hover:bg-surface-hover hover:border-edge-strong p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">
          {icon}
        </span>
        <span className="font-semibold text-fg">{title}</span>
        {badge ? (
          <span className="ml-auto text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-soft text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-fg-muted mt-1.5">{text}</p>
    </button>
  );
}

export default function NewProjectModal({ open, onClose, onCreate }) {
  const [step, setStep] = useState("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [headerColor, setHeaderColor] = useState("blue");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [source, setSource] = useState(null); // "scratch" | "template" | "ai"
  const [templateKey, setTemplateKey] = useState(null);
  const [category, setCategory] = useState("All");
  const [goal, setGoal] = useState("");
  const [draft, setDraft] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const signedIn = typeof window !== "undefined" && isSignedIn();

  useEffect(() => {
    if (!open) return;
    setStep("details");
    setName("");
    setDescription("");
    setHeaderColor("blue");
    setStartDate("");
    setEndDate("");
    setSource(null);
    setTemplateKey(null);
    setCategory("All");
    setGoal("");
    setDraft([]);
    setError(null);
    setBusy(false);
  }, [open]);

  const templates = useMemo(
    () =>
      category === "All"
        ? PROJECT_TEMPLATES
        : PROJECT_TEMPLATES.filter((t) => t.category === category),
    [category],
  );

  const create = async (milestones) => {
    setBusy(true);
    setError(null);
    try {
      await onCreate?.({
        name: name.trim(),
        description: description.trim(),
        headerColor,
        startDate: startDate || null,
        endDate: endDate || null,
        template: source === "template" ? templateKey : null,
        milestones,
      });
      onClose?.();
    } catch (e) {
      setError(e.message || "Could not create the project.");
      setBusy(false);
    }
  };

  const generate = async () => {
    setStep("loading");
    setError(null);
    try {
      const data = await apiJson("/api/projects/suggest", {
        method: "POST",
        body: JSON.stringify({
          kind: "structure",
          projectName: name.trim(),
          description: description.trim(),
          goal: goal.trim(),
        }),
      });
      const next = makeMilestoneDraft(data.milestones || []);
      if (!next.length) {
        setError("No suggestions came back. Try describing the goal in more detail.");
        setStep("ai");
        return;
      }
      setDraft(next);
      setStep("review");
    } catch (e) {
      setError(e.message || "Could not generate a structure.");
      setStep("ai");
    }
  };

  const pickTemplate = (t) => {
    setTemplateKey(t.key);
    setDraft(makeMilestoneDraft(t.milestones));
    setStep("review");
  };

  const counts = countSelected(draft, "structure");
  const badRange = isInvalidRange(startDate, endDate);
  const canContinue = name.trim().length > 0 && !badRange;

  const titles = {
    details: "New project",
    choose: "How do you want to start?",
    template: "Choose a template",
    ai: "Suggest a structure with AI",
    loading: "Suggest a structure with AI",
    review: source === "template" ? "Review the template" : "Review the suggestions",
  };

  const back = () => {
    if (step === "choose") setStep("details");
    else if (step === "template" || step === "ai") setStep("choose");
    else if (step === "review") setStep(source === "template" ? "template" : "ai");
  };

  const footer =
    step === "details" ? (
      <>
        <button type="button" className="px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm hover:bg-surface-hover" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm disabled:opacity-50"
          disabled={!canContinue}
          onClick={() => setStep("choose")}
        >
          Continue
        </button>
      </>
    ) : step === "loading" ? null : (
      <>
        <button type="button" className="px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm hover:bg-surface-hover" onClick={back} disabled={busy}>
          Back
        </button>
        {step === "ai" ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm disabled:opacity-50"
            onClick={generate}
            disabled={!signedIn}
          >
            <IconSparkle className="w-4 h-4" />
            Generate
          </button>
        ) : null}
        {step === "review" ? (
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm disabled:opacity-50"
            onClick={() => create(selectedMilestones(draft))}
            disabled={busy}
          >
            {busy
              ? "Creating…"
              : counts.milestones
                ? `Create project with ${counts.milestones} milestone${counts.milestones === 1 ? "" : "s"}${
                    counts.tasks ? ` and ${counts.tasks} task${counts.tasks === 1 ? "" : "s"}` : ""
                  }`
                : "Create empty project"}
          </button>
        ) : null}
      </>
    );

  return (
    <ModalShell
      open={open}
      onClose={busy || step === "loading" ? () => {} : onClose}
      title={titles[step]}
      subtitle={step !== "details" ? name.trim() : undefined}
      size={step === "review" || step === "template" ? "lg" : "md"}
      footer={footer}
    >
      <div className="px-5 py-4 space-y-4">
        {error ? (
          <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {step === "details" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (canContinue) setStep("choose");
            }}
          >
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                className={inputClass}
                maxLength={80}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">
                Description <span className="text-fg-subtle">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about? Used for AI suggestions too."
                rows={3}
                maxLength={1000}
                className={`${inputClass} resize-y`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-project-start-date" className="block text-xs font-medium text-fg-muted mb-1">
                  Start date <span className="text-fg-subtle">(optional)</span>
                </label>
                <input
                  id="new-project-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="new-project-end-date" className="block text-xs font-medium text-fg-muted mb-1">
                  End date <span className="text-fg-subtle">(optional)</span>
                </label>
                <input
                  id="new-project-end-date"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              {badRange ? (
                <p className="col-span-2 text-xs text-danger">The end date is before the start date.</p>
              ) : null}
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Colour</label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`w-6 h-6 rounded-full ${c.swatchClass} border-2 transition-transform hover:scale-105 ${
                      headerColor === c.key ? "border-fg" : "border-transparent"
                    }`}
                    aria-label={c.label}
                    aria-pressed={headerColor === c.key}
                    onClick={() => setHeaderColor(c.key)}
                  />
                ))}
              </div>
            </div>
          </form>
        ) : null}

        {step === "choose" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <ChoiceCard
              icon="✏️"
              title="Start from scratch"
              text="An empty project. Add milestones and tasks yourself whenever you like."
              onClick={() => {
                setSource("scratch");
                create([]);
              }}
              disabled={busy}
            />
            <ChoiceCard
              icon="📚"
              title="Use a template"
              text="Pick a ready-made milestone structure and adjust it before creating."
              onClick={() => {
                setSource("template");
                setStep("template");
              }}
              disabled={busy}
            />
            <ChoiceCard
              icon="✨"
              title="Suggest with AI"
              text="Describe the goal and get milestones with tasks to review."
              badge={signedIn ? null : "Sign in"}
              onClick={() => {
                setSource("ai");
                setGoal((g) => g || description);
                setStep("ai");
              }}
              disabled={busy}
            />
          </div>
        ) : null}

        {step === "template" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {["All", ...TEMPLATE_CATEGORIES].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    category === c
                      ? "bg-primary-soft text-primary border-primary/20"
                      : "bg-surface-2 text-fg-muted border-edge hover:bg-surface-hover"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => pickTemplate(t)}
                  className="text-left rounded-xl border border-edge bg-surface-2/60 hover:bg-surface-hover hover:border-edge-strong p-3 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">
                      {t.icon}
                    </span>
                    <span className="font-semibold text-fg">{t.name}</span>
                    <span className="ml-auto text-[10px] text-fg-subtle">
                      {t.milestones.length} milestones
                    </span>
                  </div>
                  <p className="text-xs text-fg-muted mt-1">{t.description}</p>
                  <p className="text-[11px] text-fg-subtle mt-1.5 truncate">
                    {t.milestones.map((m) => m.name).join(" → ")}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === "ai" ? (
          <div className="space-y-2">
            {!signedIn ? (
              <AiUnavailable error="Sign in to use AI suggestions. Templates work without an account." />
            ) : null}
            <label className="block text-xs font-medium text-fg-muted">
              What do you want to accomplish with this project?
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              placeholder="For example: build and launch a small SaaS for freelancers to send invoices, first paying customers within three months."
              className={`${inputClass} resize-y`}
              autoFocus
            />
            <p className="text-xs text-fg-subtle">
              You get milestones with tasks for each. Everything can be edited before the project is created.
            </p>
          </div>
        ) : null}

        {step === "loading" ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-fg-muted">
            <IconSparkle className="w-6 h-6 animate-pulse text-primary" />
            <div className="text-sm">Drafting milestones and tasks…</div>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="space-y-3">
            <p className="text-xs text-fg-subtle">
              Untick what you do not need, rename, reorder or add your own milestones and tasks. Nothing is created until you confirm.
            </p>
            <StructureReview mode="structure" items={draft} onChange={setDraft} />
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
