"use client";

// "Suggest milestones" / "Suggest tasks" flow: ask what the user wants to
// accomplish, call the AI route, then let them review (select, edit,
// reorder, add, remove) before anything is created. Nothing is saved until
// onConfirm receives the kept items.

import React, { useEffect, useMemo, useState } from "react";
import ModalShell from "@/components/planner/ModalShell";
import StructureReview, {
  countSelected,
  makeMilestoneDraft,
  makeTaskDraft,
  selectedMilestones,
  selectedTasks,
} from "@/components/planner/StructureReview";
import { IconSparkle } from "@/components/planner/MilestoneBits";
import { apiJson, isSignedIn } from "@/lib/plannerApi";
import { compareMilestones, idOf } from "@/lib/milestones";

export function AiUnavailable({ error }) {
  return (
    <div className="rounded-xl border border-edge bg-surface-2 px-4 py-3 text-sm text-fg-muted">
      {error}
    </div>
  );
}

export default function SuggestDialog({
  open,
  kind = "milestones",
  project,
  milestone = null,
  milestones = [],
  tasks = [],
  onClose,
  onConfirm,
}) {
  const [step, setStep] = useState("ask");
  const [goal, setGoal] = useState("");
  const [draft, setDraft] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const signedIn = typeof window !== "undefined" && isSignedIn();

  useEffect(() => {
    if (!open) return;
    setStep("ask");
    setGoal(project?.description || "");
    setDraft([]);
    setError(null);
    setSaving(false);
  }, [open, project?._id, project?.description, milestone?._id]);

  const projectMilestoneNames = useMemo(
    () =>
      [...milestones]
        .filter((m) => idOf(m.project) === idOf(project?._id))
        .sort(compareMilestones)
        .map((m) => m.name),
    [milestones, project?._id],
  );
  const milestoneTaskTitles = useMemo(
    () =>
      milestone
        ? tasks
            .filter((t) => idOf(t.milestone) === idOf(milestone._id) && !t.parentTask)
            .map((t) => t.title)
        : [],
    [tasks, milestone],
  );

  const generate = async () => {
    setStep("loading");
    setError(null);
    try {
      const body = {
        kind,
        projectName: project?.name || "Project",
        description: project?.description || "",
        goal: goal.trim(),
        existingMilestones: projectMilestoneNames,
        ...(kind === "tasks" && milestone
          ? {
              milestone: { name: milestone.name, description: milestone.description || "" },
              existingTasks: milestoneTaskTitles,
            }
          : {}),
      };
      const data = await apiJson("/api/projects/suggest", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const next =
        kind === "tasks"
          ? makeTaskDraft(data.tasks || [])
          : makeMilestoneDraft(data.milestones || []);
      if (!next.length) {
        setError("No suggestions came back. Try describing the goal in more detail.");
        setStep("ask");
        return;
      }
      setDraft(next);
      setStep("review");
    } catch (e) {
      setError(e.message || "Could not generate suggestions.");
      setStep("ask");
    }
  };

  const counts = countSelected(draft, kind === "tasks" ? "tasks" : "milestones");
  const selectedCount = kind === "tasks" ? counts.tasks : counts.milestones;

  const confirm = async () => {
    if (!selectedCount) return;
    setSaving(true);
    try {
      if (kind === "tasks") await onConfirm?.({ tasks: selectedTasks(draft) });
      else await onConfirm?.({ milestones: selectedMilestones(draft) });
      onClose?.();
    } catch (e) {
      setError(e.message || "Could not add the suggestions.");
    } finally {
      setSaving(false);
    }
  };

  const title = kind === "tasks" ? "Suggest tasks" : "Suggest milestones";
  const subtitle =
    kind === "tasks" && milestone
      ? `${project?.name || ""} · ${milestone.name}`
      : project?.name || "";

  const footer =
    step === "review" ? (
      <>
        <button
          type="button"
          className="px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm hover:bg-surface-hover"
          onClick={() => setStep("ask")}
          disabled={saving}
        >
          Back
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm disabled:opacity-50"
          onClick={confirm}
          disabled={!selectedCount || saving}
        >
          {saving
            ? "Adding…"
            : `Add ${selectedCount} ${kind === "tasks" ? "task" : "milestone"}${
                selectedCount === 1 ? "" : "s"
              }`}
        </button>
      </>
    ) : step === "ask" ? (
      <>
        <button
          type="button"
          className="px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm hover:bg-surface-hover"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm disabled:opacity-50"
          onClick={generate}
          disabled={!signedIn}
        >
          <IconSparkle className="w-4 h-4" />
          Generate
        </button>
      </>
    ) : null;

  return (
    <ModalShell
      open={open}
      onClose={saving || step === "loading" ? () => {} : onClose}
      title={title}
      subtitle={subtitle}
      size={step === "review" ? "lg" : "md"}
      footer={footer}
    >
      <div className="px-5 py-4 space-y-3">
        {!signedIn ? (
          <AiUnavailable error="Sign in to use AI suggestions. Templates and manual milestones work without an account." />
        ) : null}
        {error ? (
          <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {step === "ask" ? (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-fg-muted">
              {kind === "tasks"
                ? `What should "${milestone?.name || "this milestone"}" achieve?`
                : "What do you want to accomplish with this project?"}
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              placeholder={
                kind === "tasks"
                  ? "Optional. Anything specific: tools, constraints, what done looks like…"
                  : "For example: build and launch a small SaaS for freelancers to send invoices, first paying customers within three months."
              }
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none focus:ring-2 focus:ring-focus/40 resize-y"
              autoFocus
            />
            <p className="text-xs text-fg-subtle">
              {kind === "tasks"
                ? "The AI already knows the project and its other milestones."
                : "A short description is enough. You will review every suggestion before it is added."}
            </p>
          </div>
        ) : null}

        {step === "loading" ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-fg-muted">
            <IconSparkle className="w-6 h-6 animate-pulse text-primary" />
            <div className="text-sm">Thinking about {kind === "tasks" ? "the tasks" : "the milestones"}…</div>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="space-y-3">
            <p className="text-xs text-fg-subtle">
              Untick anything you do not want, rename, reorder or add your own. Only the ticked items are added.
            </p>
            <StructureReview
              mode={kind === "tasks" ? "tasks" : "milestones"}
              items={draft}
              onChange={setDraft}
            />
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
