"use client";

// The few things a business needs in order to exist: a name, what kind of
// business it is, optionally a line about it and the currency it counts in.
// Used three ways: the onboarding card of an empty Business page, the "New
// business" dialog and the "Edit business" dialog (where the type is fixed,
// because it only decided which work items the business started with).

import React, { useState } from "react";
import { BUSINESS_TYPES, BUSINESS_CURRENCIES, LIMITS, businessTypeMeta } from "@/lib/business/phases";
import { ActionButton, Field, inputClass } from "@/components/business/businessUi";

export default function BusinessForm({ initial = null, submitLabel = "Create business", onSubmit, onCancel = null }) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [currency, setCurrency] = useState(initial?.currency || "EUR");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const nameError = !name.trim() ? "Give the business a name." : "";
  const typeError = !editing && !type ? "Choose what kind of business it is." : "";

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (nameError || typeError || busy) return;
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        currency,
        ...(editing ? {} : { type }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Business name">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.name}
          placeholder="e.g. Northwind Coffee"
          autoFocus
          aria-invalid={touched && !!nameError}
          data-testid="business-name"
        />
        {touched && nameError ? <span className="block text-xs text-danger">{nameError}</span> : null}
      </Field>

      {editing ? (
        <Field label="Kind of business" hint="Set when the business was created. It decided the work items it started with.">
          <div className={`${inputClass} text-fg-muted`}>{businessTypeMeta(initial.type).label}</div>
        </Field>
      ) : (
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold uppercase tracking-wide text-fg-subtle">What kind of business is it?</span>
          <div role="radiogroup" aria-label="Kind of business" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BUSINESS_TYPES.map((option) => {
              const active = option.key === type;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(option.key)}
                  data-testid={`business-type-${option.key}`}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                    active ? "border-primary bg-primary-soft" : "border-edge bg-surface-2 hover:border-edge-strong"
                  }`}
                >
                  <span className="block text-sm font-semibold text-fg">{option.label}</span>
                  <span className="block text-xs text-fg-muted">{option.hint}</span>
                </button>
              );
            })}
          </div>
          {touched && typeError ? <span className="block text-xs text-danger">{typeError}</span> : null}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
        <Field label="What does it do? (optional)">
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LIMITS.description}
            placeholder="One line is enough"
          />
        </Field>
        <Field label="Currency">
          <select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {BUSINESS_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <ActionButton tone="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </ActionButton>
        ) : null}
        <ActionButton type="submit" tone="primary" busy={busy}>
          {submitLabel}
        </ActionButton>
      </div>
    </form>
  );
}
