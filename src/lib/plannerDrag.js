// A drag that starts outside the week calendar (the Tasks panel beside it in
// the planner's split view) and may end on it.
//
// HTML5 drag data can only be read on drop, but while a task hovers over the
// hour grid the calendar needs its length to draw the preview. So the source
// leaves the payload here when the drag starts and clears it when it ends,
// and marks the drag with PLANNER_DRAG_TYPE so the calendar knows to look.
// Shared with the browser only; nothing here touches the server.

export const PLANNER_DRAG_TYPE = "application/x-pomodrive-task";

let current = null;

/** @param {{ taskName: string, projectId?: string|null, duration?: number }} payload */
export function startExternalDrag(payload) {
  current = payload;
}

/** The payload of a drag in progress, or null. */
export function externalDrag() {
  return current;
}

export function endExternalDrag() {
  current = null;
}

/** True when a drag event carries a task from outside the calendar. */
export function isExternalTaskDrag(e) {
  return Boolean(current) && [...(e?.dataTransfer?.types || [])].includes(PLANNER_DRAG_TYPE);
}
