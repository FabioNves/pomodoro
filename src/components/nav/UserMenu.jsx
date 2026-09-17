"use client";

// Everything about the account, under the user's own name: settings, the
// admin page, the admin's view-as switcher, pricing and signing out. It
// keeps those out of the main menu, which is for the app's screens.

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAccess } from "@/lib/access/client";

const VIEW_OPTIONS = [
  { value: null, label: "Admin", hint: "Everything, as it really is" },
  { value: "premium", label: "Preview as Premium", hint: "What a paying user sees" },
  { value: "free", label: "Preview as Free", hint: "What a free user sees" },
];

function IconSettings({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  );
}

function IconShield({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconSpark({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
    </svg>
  );
}

function IconLogout({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function IconChevron({ className = "w-3 h-3" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const ROLE_LABEL = { admin: "Admin", premium: "Premium", free: "Free" };

function Item({ href, onClick, Icon, children, hint, tone = "default" }) {
  const tones = {
    default: "text-fg hover:bg-surface-hover",
    danger: "text-danger hover:bg-danger-soft",
  };
  const cls = `w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${tones[tone]}`;
  const body = (
    <>
      {Icon ? <Icon className="w-4 h-4 mt-0.5 shrink-0" /> : null}
      <span className="min-w-0">
        <span className="block font-medium leading-tight">{children}</span>
        {hint ? <span className="block text-[11px] text-fg-subtle leading-tight">{hint}</span> : null}
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={cls} role="menuitem">
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} role="menuitem">
      {body}
    </button>
  );
}

function Group({ label, children }) {
  return (
    <div className="pt-1">
      <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
      {children}
    </div>
  );
}

export default function UserMenu({ user, onLogout, showPricing = false }) {
  const access = useAccess();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chooseView = async (value) => {
    if (busy || (value || null) === (access.viewAs || null)) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await access.setViewAs(value);
    } catch (error) {
      toast.error(error.message || "Could not switch the preview.");
      setBusy(false);
    }
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() || "?";
  const role = access.me ? access.role : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="user-menu-button"
        className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-colors ${
          open ? "bg-surface-hover border-edge-strong" : "bg-primary-soft border-edge hover:border-edge-strong"
        }`}
      >
        <span className="w-6 h-6 bg-gradient-to-br from-gradient-start to-gradient-end rounded-full flex items-center justify-center shadow-md shadow-primary/25 shrink-0">
          <span className="text-primary-fg text-[11px] font-semibold">{initial}</span>
        </span>
        <span className="hidden sm:inline text-fg text-xs font-semibold max-w-[9rem] truncate">{user?.name}</span>
        <IconChevron className={`w-3 h-3 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          data-testid="user-menu"
          className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] p-1.5 rounded-xl border border-edge bg-surface shadow-2xl z-[70]"
        >
          <div className="px-3 py-2 border-b border-edge mb-1">
            <p className="text-sm font-semibold text-fg truncate">{user?.name}</p>
            <p className="text-[11px] text-fg-subtle truncate">{access.user?.email || ""}</p>
            {role ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                {ROLE_LABEL[role] || role}
                {access.previewing ? <span className="text-warning">· previewing</span> : null}
              </p>
            ) : null}
          </div>

          <Item href="/settings" Icon={IconSettings} onClick={() => setOpen(false)}>
            Settings
          </Item>
          {showPricing ? (
            <Item href="/pricing" Icon={IconSpark} onClick={() => setOpen(false)} hint="See what Premium adds">
              Plans and pricing
            </Item>
          ) : null}
          {/* Hidden while previewing: a free user has no admin page. The
              banner is the way back, and the switcher below stays. */}
          {access.isAdmin && !access.previewing ? (
            <Item href="/admin" Icon={IconShield} onClick={() => setOpen(false)} hint="Connections, usage, users, plans">
              Admin
            </Item>
          ) : null}

          {access.isAdmin ? (
            <Group label="View as">
              {VIEW_OPTIONS.map((o) => {
                const active = (o.value || null) === (access.viewAs || null);
                return (
                  <button
                    key={o.label}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    disabled={busy}
                    onClick={() => chooseView(o.value)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm text-left transition-colors disabled:opacity-60 ${
                      active ? "bg-primary-soft text-primary font-semibold" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block leading-tight">{o.label}</span>
                      <span className="block text-[11px] text-fg-subtle leading-tight">{o.hint}</span>
                    </span>
                    {active ? <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" /> : null}
                  </button>
                );
              })}
            </Group>
          ) : null}

          <div className="mt-1 pt-1 border-t border-edge">
            <Item
              Icon={IconLogout}
              tone="danger"
              onClick={() => {
                setOpen(false);
                onLogout?.();
              }}
            >
              Log out
            </Item>
          </div>
        </div>
      ) : null}
    </div>
  );
}
