import { z } from "zod";
import { connectToDB } from "@/lib/db";
import BudgetEntry from "@/models/BudgetEntry";
import BudgetSeries from "@/models/BudgetSeries";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { BUDGET_LIMITS, FALLBACK_CATEGORY, isFallbackCategory } from "@/lib/budget/categories";
import {
  SIGN_IN,
  entryType,
  categoryKey,
  categoryLabel,
  run,
  apiError,
  ensureSettings,
  settingsDto,
} from "@/lib/budget/server";

function slug(text) {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "category"
  );
}

// POST /api/budget/categories  { label, type }
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ label: categoryLabel, type: entryType }));
  if (!body.ok) return body.response;

  return run("POST budget category", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    if (settings.categories.length >= BUDGET_LIMITS.categories) {
      throw apiError(400, `A budget can have up to ${BUDGET_LIMITS.categories} categories.`);
    }
    const sameName = settings.categories.find(
      (c) => c.type === body.data.type && c.label.toLowerCase() === body.data.label.toLowerCase(),
    );
    if (sameName) throw apiError(409, `There is already a category called ${sameName.label}.`);

    const taken = new Set(settings.categories.map((c) => c.key));
    const base = `c_${slug(body.data.label)}`;
    let key = base;
    for (let n = 2; taken.has(key); n += 1) key = `${base}_${n}`;
    settings.categories.push({ key, label: body.data.label, type: body.data.type, custom: true });
    await settings.save();
    return Response.json({ settings: settingsDto(settings), key }, { status: 201 });
  });
}

// PATCH /api/budget/categories  { key, label }
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ key: categoryKey, label: categoryLabel }));
  if (!body.ok) return body.response;

  return run("PATCH budget category", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    const category = settings.categories.find((c) => c.key === body.data.key);
    if (!category) throw apiError(404, "Category not found");
    category.label = body.data.label;
    await settings.save();
    return Response.json({ settings: settingsDto(settings) });
  });
}

// DELETE /api/budget/categories  { key }
// Its entries, and the repeating ones, move to the type's "Other".
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ key: categoryKey }));
  if (!body.ok) return body.response;

  return run("DELETE budget category", async () => {
    await connectToDB();
    const settings = await ensureSettings(auth.userId);
    const category = settings.categories.find((c) => c.key === body.data.key);
    if (!category) throw apiError(404, "Category not found");
    if (isFallbackCategory(category.key)) throw apiError(400, "Every type keeps its Other category.");
    const fallback = FALLBACK_CATEGORY[category.type];
    await BudgetEntry.updateMany({ user: auth.userId, category: category.key }, { $set: { category: fallback } });
    await BudgetSeries.updateMany({ user: auth.userId, category: category.key }, { $set: { category: fallback } });
    settings.categories = settings.categories.filter((c) => c.key !== category.key);
    await settings.save();
    return Response.json({ settings: settingsDto(settings), movedTo: fallback });
  });
}
