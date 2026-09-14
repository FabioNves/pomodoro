"use client";

// Compact milestone list shown in a board column between the project header
// and its tasks: name, progress, status, and a complete toggle.

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevron } from "@/components/planner/TaskRow";
import {
  MilestoneToggle,
  ProgressBar,
  StatusPill,
  MilestoneMeta,
} from "@/components/planner/MilestoneBits";
import { compareMilestones, milestoneProgress } from "@/lib/milestones";

export default function MilestoneStrip({
  milestones = [],
  tasks = [],
  onManage,
  onToggleComplete,
  onOpenMilestone,
}) {
  const [open, setOpen] = useState(true);
  const sorted = useMemo(() => [...milestones].sort(compareMilestones), [milestones]);
  const completed = sorted.filter((m) => m.status === "completed").length;

  return (
    <div className="px-2 pt-2">
      <div className="flex items-center gap-2 py-1 px-1">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-subtle uppercase tracking-wider whitespace-nowrap"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Milestones
          {sorted.length ? (
            <span className="normal-case tracking-normal font-medium">
              {completed}/{sorted.length}
            </span>
          ) : null}
          <IconChevron open={open} className="w-3 h-3" />
        </button>
        <div className="flex-1 h-px bg-edge" />
        <button
          type="button"
          className="text-[11px] font-medium text-primary hover:text-primary-hover"
          onClick={() => onManage?.("milestones")}
        >
          {sorted.length ? "Manage" : "+ Add"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {sorted.length ? (
              <div className="space-y-0.5 pb-1">
                {sorted.map((m) => {
                  const progress = milestoneProgress(m, tasks);
                  const done = m.status === "completed";
                  return (
                    <div
                      key={m._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenMilestone?.(m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenMilestone?.(m);
                        }
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-hover cursor-pointer"
                    >
                      <MilestoneToggle
                        completed={done}
                        onToggle={() => onToggleComplete?.(m)}
                        size="w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex-1 min-w-0 text-sm truncate ${
                              done ? "text-fg-subtle line-through" : "text-fg"
                            }`}
                          >
                            {m.name}
                          </div>
                          <StatusPill status={m.status} />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <ProgressBar percent={progress.percent} status={m.status} className="flex-1" />
                          <span className="text-[10px] text-fg-subtle w-8 text-right tabular-nums">
                            {progress.percent}%
                          </span>
                        </div>
                        <MilestoneMeta milestone={m} progress={progress} className="mt-0.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-2 text-xs text-fg-subtle italic">
                No milestones yet
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
