"use client";

// Admin › Users: who is signed in right now, the user table with search,
// filters and sorting, and the row actions (change plan, revoke sessions).

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { accessApi } from "@/lib/access/client";
import { ActionButton, Chip, SectionTitle, Spinner } from "@/components/news/newsUi";
import {
  EmptyRow,
  IconUsers,
  Stat,
  Table,
  Td,
  Tr,
  formatDay,
  formatNumber,
  inputClass,
  relativeTime,
} from "@/components/admin/adminUi";

const COUNTER_MS = 30000;

const SESSION_TONE = { active: "success", recent: "primary", idle: "neutral", never: "neutral", revoked: "accent" };
const SESSION_LABEL = { active: "Active", recent: "Recent", idle: "Idle", never: "Never signed in", revoked: "Revoked" };
const ROLE_TONE = { admin: "accent", premium: "primary", free: "neutral" };

function PlanEditor({ user, onSaved }) {
  const [plan, setPlan] = useState(user.plan);
  const [expires, setExpires] = useState(user.planExpiresAt ? String(user.planExpiresAt).slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const dirty = plan !== user.plan || (expires || "") !== (user.planExpiresAt ? String(user.planExpiresAt).slice(0, 10) : "");

  const save = async () => {
    setBusy(true);
    try {
      const body = { id: user.id, plan };
      body.planExpiresAt = plan === "premium" && expires ? new Date(`${expires}T23:59:59.000Z`).toISOString() : null;
      const data = await accessApi("/api/admin/users", { method: "PATCH", body });
      onSaved(data.user);
      toast.success(`${user.email} is now on ${plan}.`);
    } catch (error) {
      toast.error(error.message || "Could not change the plan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select aria-label={`Plan for ${user.email}`} value={plan} onChange={(e) => setPlan(e.target.value)} className={`${inputClass} py-1`}>
        <option value="free">Free</option>
        <option value="premium">Premium</option>
      </select>
      {plan === "premium" ? (
        <input type="date" aria-label={`Premium until, for ${user.email}`} title="Expiry (empty = never)" value={expires} onChange={(e) => setExpires(e.target.value)} className={`${inputClass} py-1`} />
      ) : null}
      {dirty ? (
        <ActionButton size="sm" tone="primary" busy={busy} onClick={save}>
          Save
        </ActionButton>
      ) : null}
    </div>
  );
}

export default function AdminUsers({ selfId }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [plan, setPlan] = useState("");
  const [sort, setSort] = useState("lastActive");
  const [dir, setDir] = useState("desc");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [counter, setCounter] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, dir });
      if (q.trim()) params.set("q", q.trim());
      if (role) params.set("role", role);
      if (plan) params.set("plan", plan);
      const data = await accessApi(`/api/admin/users?${params}`);
      setRows(data.users);
      setMeta(data);
      setCounter({ activeNow: data.activeNow, total: data.total, at: data.at });
    } catch (error) {
      toast.error(error.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [q, role, plan, sort, dir]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Live-ish counter: the cheap count endpoint every 30 s.
  useEffect(() => {
    const tick = async () => {
      try {
        const data = await accessApi("/api/admin/users?countOnly=1");
        setCounter((c) => ({ ...(c || {}), activeNow: data.activeNow, at: data.at, allUsers: data.total }));
      } catch {
        /* keep the last value */
      }
    };
    tick();
    const timer = setInterval(tick, COUNTER_MS);
    return () => clearInterval(timer);
  }, []);

  const replaceRow = (user) => setRows((list) => list.map((r) => (r.id === user.id ? user : r)));

  const revoke = async (user) => {
    const self = user.id === selfId;
    const ok = window.confirm(
      self
        ? "Revoke your own sessions? You will be signed out everywhere, including here."
        : `Sign ${user.email} out of every device? Their current sessions stop working at once.`,
    );
    if (!ok) return;
    try {
      const data = await accessApi("/api/admin/users", { method: "PATCH", body: { id: user.id, revokeSessions: true } });
      replaceRow(data.user);
      toast.success(`Sessions revoked for ${user.email}.`);
      if (self) window.location.replace("/");
    } catch (error) {
      toast.error(error.message || "Could not revoke the sessions.");
    }
  };

  const toggleSort = (key) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "email" ? "asc" : "desc");
    }
  };
  const sortLabel = (key, label) => (
    <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-fg">
      {label}
      {sort === key ? <span aria-hidden="true">{dir === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle Icon={IconUsers} count={meta?.total}>
          Users
        </SectionTitle>
        {loading ? <Spinner /> : null}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Stat label="Active now" value={counter ? formatNumber(counter.activeNow) : "…"} hint="Signed-in request in the last 15 min" tone="success" />
        <Stat label="All users" value={counter?.allUsers !== undefined ? formatNumber(counter.allUsers) : meta ? formatNumber(meta.total) : "…"} hint="Accounts" />
        <Stat label="Premium" value={formatNumber(rows.filter((r) => r.role === "premium").length)} hint="In the current list" tone="primary" />
        <Stat label="Updated" value={counter?.at ? relativeTime(counter.at) : "…"} hint="Counter refreshes every 30 s" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="search" placeholder="Search email or name" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputClass} w-56`} />
        <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="premium">Premium</option>
          <option value="free">Free</option>
        </select>
        <select aria-label="Filter by plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass}>
          <option value="">All plans</option>
          <option value="free">Free plan</option>
          <option value="premium">Premium plan</option>
        </select>
        <ActionButton size="sm" onClick={load} busy={loading}>
          Refresh
        </ActionButton>
        {meta?.truncated ? <span className="text-xs text-warning">Showing the first 500 users; narrow the search.</span> : null}
      </div>

      <Table
        columns={[
          { key: "email", label: sortLabel("email", "Email") },
          { key: "role", label: sortLabel("role", "Role") },
          { key: "plan", label: "Plan" },
          { key: "signup", label: sortLabel("signup", "Signed up") },
          { key: "last", label: sortLabel("lastActive", "Last active") },
          { key: "session", label: "Session" },
          { key: "actions", label: "Actions" },
        ]}
        minWidth="64rem"
        caption="Users"
      >
        {rows.length ? (
          rows.map((u) => (
            <Tr key={u.id}>
              <Td>
                <div className="flex items-center gap-2 min-w-0">
                  {u.imageUrl ? (
                    <img src={u.imageUrl} alt="" className="w-6 h-6 rounded-full shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-primary-soft text-primary text-[11px] font-semibold flex items-center justify-center shrink-0">{u.name?.charAt(0)?.toUpperCase()}</span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-fg">{u.email}</p>
                    <p className="truncate text-xs text-fg-subtle">
                      {u.name}
                      {u.id === selfId ? " · you" : ""}
                      {u.viewAs ? ` · previewing as ${u.viewAs}` : ""}
                    </p>
                  </div>
                </div>
              </Td>
              <Td>
                <Chip tone={ROLE_TONE[u.role]}>{u.role}</Chip>
              </Td>
              <Td>
                <PlanEditor user={u} onSaved={replaceRow} />
                {u.plan === "premium" && u.planExpiresAt ? <p className="text-[11px] text-fg-subtle mt-0.5">until {formatDay(u.planExpiresAt)}</p> : null}
              </Td>
              <Td className="whitespace-nowrap">{formatDay(u.createdAt)}</Td>
              <Td className="whitespace-nowrap" title={u.lastActiveAt || ""}>
                {relativeTime(u.lastActiveAt)}
              </Td>
              <Td>
                <Chip tone={SESSION_TONE[u.sessionStatus] || "neutral"}>{SESSION_LABEL[u.sessionStatus] || u.sessionStatus}</Chip>
              </Td>
              <Td>
                <ActionButton size="sm" tone="ghost" onClick={() => revoke(u)} disabled={u.sessionStatus === "revoked" || u.sessionStatus === "never"} title="Sign this user out of every device">
                  Revoke sessions
                </ActionButton>
              </Td>
            </Tr>
          ))
        ) : (
          <EmptyRow colSpan={7}>{loading ? "Loading…" : "No users match."}</EmptyRow>
        )}
      </Table>
    </div>
  );
}
