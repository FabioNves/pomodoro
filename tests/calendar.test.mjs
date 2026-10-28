import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import mongoose from "mongoose";
import { datedTaskView, datedTaskPlacement, preferredWeekPlans } from "../src/lib/calendarTasks.mjs";

const owner = "calendar-test-user";
const id = "123456789012345678901234";
const request = (body) => new Request("http://localhost/api/test", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// Execute the actual route with an isolated database adapter. No live writes.
async function loadRoute(file, adapters) {
  const source = (await fs.readFile(new URL(file, import.meta.url), "utf8"))
    .replace(/import\s+[\s\S]*?\s+from\s+["'][^"']+["'];/g, "")
    .replace(/export async function/g, "async function");
  const values = {
    z, createHash, preferredWeekPlans,
    connectToDB: async () => {},
    getIdentityHeaders: () => ({ userId: owner }),
    validateIdentityHeaders: async () => ({ ok: true, data: { userId: owner } }),
    validateJsonBody: async (req, schema) => {
      const result = schema.safeParse(await req.json());
      return result.success ? { ok: true, data: result.data } : { ok: false, response: Response.json({ error: "Invalid body" }, { status: 400 }) };
    },
    validateSearchParams: () => ({ ok: true, data: {} }),
    jsonError: (status, error) => Response.json({ error }, { status }),
    ...adapters,
  };
  return new Function(...Object.keys(values), `${source}; return { GET, POST, PATCH, DELETE };`)(...Object.values(values));
}

test("populated week 43 is preferred over a newer empty copy without discarding copies or times", () => {
  const empty = { _id: "empty", weekStart: "2026-10-19", createdAt: "2026-10-24", days: [] };
  const original = { _id: "original", weekStart: empty.weekStart, createdAt: "2026-10-19", days: [{ tasks: [{ startMinute: 540 }] }] };
  const input = [empty, original];
  const sorted = preferredWeekPlans(input);
  assert.deepEqual(sorted.map((p) => p._id), ["original", "empty"]);
  assert.equal(sorted[0].days[0].tasks[0].startMinute, 540);
  assert.equal(input[0], empty);
});

test("creating an existing week reopens its populated plan and never overwrites it", async () => {
  let writes = 0;
  const original = { _id: id, weekStart: "2026-10-19", days: [{ tasks: [{ startMinute: 600 }] }] };
  const route = await loadRoute("../src/app/api/week-plans/route.js", {
    WeekPlan: {
      find: (query) => {
        assert.equal(query.user, owner);
        return { lean: async () => [{ _id: "empty", weekStart: original.weekStart, days: [] }, original] };
      },
      findOneAndUpdate: () => { writes++; },
    },
  });
  const response = await route.POST(request({ name: "Week 43", weekStart: original.weekStart }));
  assert.equal(response.status, 200);
  assert.equal((await response.json())._id, id);
  assert.equal(writes, 0);
});

test("concurrent first requests for the same account/week converge on one id", async () => {
  const stored = new Map();
  const route = await loadRoute("../src/app/api/week-plans/route.js", {
    WeekPlan: {
      find: () => ({ lean: async () => [] }),
      findOneAndUpdate: async (filter, update, options) => {
        assert.equal(filter.user, owner);
        assert.equal(options.upsert, true);
        if (!stored.has(filter._id)) stored.set(filter._id, { _id: filter._id, ...update.$setOnInsert });
        return stored.get(filter._id);
      },
    },
  });
  const responses = await Promise.all(Array.from({ length: 5 }, () => route.POST(request({ name: "Week 44", weekStart: "2026-10-26" }))));
  const results = await Promise.all(responses.map((response) => response.json()));
  assert.equal(stored.size, 1);
  assert.equal(new Set(results.map((result) => result._id)).size, 1);
});

test("dated task timing survives display conversion, including midnight", () => {
  const task = { _id: id, title: "Send email", project: "project", startMinute: 0, durationMinutes: 30 };
  const view = datedTaskView(task);
  assert.equal(view.sourceTaskId, id);
  assert.equal(view.startMinute, 0);
  assert.equal(view.durationMinutes, 30);
  assert.equal(view.taskName, "Send email");
});

test("dragging a dated task across DST sets the intended date without changing its timeline", () => {
  process.env.TZ = "Europe/Berlin";
  const update = datedTaskPlacement("2026-10-19", 6, { startMinute: 570, durationMinutes: 45 });
  assert.deepEqual(update, { scheduledDate: "2026-10-25", startMinute: 570, durationMinutes: 45 });
  assert.equal(datedTaskPlacement("2026-10-26", 6, {}).scheduledDate, "2026-11-01");
  assert.equal("startDate" in update, false);
});

test("task API persists calendar time, supports clearing it, and rejects invalid minutes", async () => {
  let stored = { _id: id, title: "Send email", startDate: "2026-10-01", endDate: "2026-10-31" };
  const route = await loadRoute("../src/app/api/tasks/route.js", {
    Task: {
      findOneAndUpdate: async (query, update) => {
        assert.equal(query.user, owner);
        stored = { ...stored, ...update.$set };
        return stored;
      },
    },
    ProjectMilestone: {},
  });
  let response = await route.PATCH(request({ id, scheduledDate: "2026-10-28", startMinute: 600, durationMinutes: 45 }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).startMinute, 600);
  assert.equal(stored.startDate, "2026-10-01");
  response = await route.PATCH(request({ id, startMinute: null }));
  assert.equal((await response.json()).startMinute, null);
  response = await route.PATCH(request({ id, startMinute: 1440 }));
  assert.equal(response.status, 400);
  assert.equal(stored.startMinute, null);
});

test("task database schema retains the new timing fields on save", async () => {
  const source = (await fs.readFile(new URL("../src/models/Task.js", import.meta.url), "utf8"))
    .replace('import mongoose from "mongoose";', "")
    .replace("export default", "return");
  const Task = new Function("mongoose", source)(mongoose);
  const task = new Task({ title: "Send email", project: id, startMinute: 0, durationMinutes: 45 });
  assert.equal(task.toObject().startMinute, 0);
  assert.equal(task.toObject().durationMinutes, 45);
  assert.equal(task.validateSync(), undefined);
});
