"use client";

// Task actions for one week plan (add / toggle / edit / delete / move) with
// optimistic updates, for places outside the planner page such as the
// dashboard's today column. `setPlan(updated)` replaces the plan in the
// caller's state; `createPlan()` may lazily create the plan when none exists.

import { useCallback } from "react";
import { apiJson } from "@/utils/apiClient";
import { originDayAfterMove } from "@/lib/weekPlanView";

// The API names a task's project `projectId`; the task itself calls it
// `project`. Optimistic copies must use the task's name for it to show.
function asTaskFields(updates) {
  if (!updates || !("projectId" in updates)) return updates;
  const { projectId, ...rest } = updates;
  return { ...rest, project: projectId || null };
}

export function useWeekPlanTasks({ plan, setPlan, createPlan, onError }) {
  const fail = useCallback(
    async (e) => {
      console.error(e);
      onError?.(e);
      if (!plan?._id) return;
      try {
        setPlan(await apiJson(`/api/week-plans?id=${plan._id}`));
      } catch (err) {
        console.error(err);
      }
    },
    [plan?._id, setPlan, onError],
  );

  const patchDays = useCallback(
    (p, dayOfWeek, fn) => ({
      ...p,
      days: p.days.map((d) => (d.dayOfWeek !== dayOfWeek ? d : fn(d))),
    }),
    [],
  );

  const addTask = useCallback(
    async (dayOfWeek, data) => {
      let p = plan;
      if (!p) {
        p = createPlan ? await createPlan() : null;
        if (!p) return;
      } else {
        setPlan(
          patchDays(p, dayOfWeek, (d) => ({
            ...d,
            tasks: [
              ...d.tasks,
              {
                _id: "temp_" + Date.now(),
                taskName: data.taskName,
                estimatedTime: data.estimatedTime || 0,
                notes: data.notes || "",
                completed: !!data.completed,
                order: d.tasks.length,
                routineTask: data.routineTaskId || null,
                project: data.projectId || null,
                startMinute: data.startMinute ?? null,
                durationMinutes: data.durationMinutes ?? null,
                originDay: data.originDay ?? null,
              },
            ],
          })),
        );
      }
      try {
        setPlan(
          await apiJson("/api/week-plans/tasks", {
            method: "POST",
            body: JSON.stringify({ weekPlanId: p._id, dayOfWeek, ...data }),
          }),
        );
      } catch (e) {
        fail(e);
      }
    },
    [plan, setPlan, createPlan, patchDays, fail],
  );

  const updateTask = useCallback(
    async (dayOfWeek, taskId, updates) => {
      if (!plan) return;
      setPlan(
        patchDays(plan, dayOfWeek, (d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            String(t._id) === String(taskId) ? { ...t, ...asTaskFields(updates) } : t,
          ),
        })),
      );
      try {
        setPlan(
          await apiJson("/api/week-plans/tasks", {
            method: "PATCH",
            body: JSON.stringify({ weekPlanId: plan._id, dayOfWeek, taskId, ...updates }),
          }),
        );
      } catch (e) {
        fail(e);
      }
    },
    [plan, setPlan, patchDays, fail],
  );

  const toggleTask = useCallback(
    (dayOfWeek, taskId, completed) => updateTask(dayOfWeek, taskId, { completed }),
    [updateTask],
  );

  const deleteTask = useCallback(
    async (dayOfWeek, taskId) => {
      if (!plan) return;
      setPlan(
        patchDays(plan, dayOfWeek, (d) => ({
          ...d,
          tasks: d.tasks.filter((t) => String(t._id) !== String(taskId)),
        })),
      );
      try {
        setPlan(
          await apiJson("/api/week-plans/tasks", {
            method: "DELETE",
            body: JSON.stringify({ weekPlanId: plan._id, dayOfWeek, taskId }),
          }),
        );
      } catch (e) {
        fail(e);
      }
    },
    [plan, setPlan, patchDays, fail],
  );

  const moveTask = useCallback(
    async ({ taskId, fromDayOfWeek, toDayOfWeek, toProjectId, startMinute, durationMinutes }) => {
      if (!plan) return;
      if (typeof taskId !== "string" || taskId.startsWith("temp_")) return;
      const timing = {
        ...(startMinute !== undefined ? { startMinute } : {}),
        ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      };
      let moved = null;
      let next = patchDays(plan, fromDayOfWeek, (d) => ({
        ...d,
        tasks: d.tasks.filter((t) => {
          if (String(t._id) === String(taskId)) {
            moved = t;
            return false;
          }
          return true;
        }),
      }));
      if (moved) {
        next = patchDays(next, toDayOfWeek, (d) => ({
          ...d,
          tasks: [
            ...d.tasks,
            {
              ...moved,
              project: toProjectId !== undefined ? toProjectId : moved.project || null,
              order: d.tasks.length,
              originDay: originDayAfterMove(moved, fromDayOfWeek, toDayOfWeek),
              ...timing,
            },
          ],
        }));
        setPlan(next);
      }
      try {
        setPlan(
          await apiJson("/api/week-plans/tasks/move", {
            method: "POST",
            body: JSON.stringify({
              weekPlanId: plan._id,
              fromDayOfWeek,
              toDayOfWeek,
              taskId,
              toProjectId: toProjectId ?? null,
              ...timing,
            }),
          }),
        );
      } catch (e) {
        fail(e);
      }
    },
    [plan, setPlan, patchDays, fail],
  );

  return { addTask, updateTask, toggleTask, deleteTask, moveTask };
}
