"use client";

// Admin › Connections: the canonical home of the connection report.

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { accessApi } from "@/lib/access/client";
import { SectionTitle, IconGlobe, IconSettings } from "@/components/news/newsUi";
import ConnectionStatus from "@/components/admin/ConnectionStatus";

export default function AdminConnections() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      setStatus(await accessApi(`/api/admin/connections${refresh ? "?refresh=1" : ""}`));
    } catch (error) {
      toast.error(error.message || "Could not check the connections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return (
    <div className="space-y-4">
      <SectionTitle Icon={IconGlobe}>Connection</SectionTitle>
      <div className="rounded-xl border border-edge bg-surface-2/40 p-4">
        <ConnectionStatus status={status} loading={loading} onRefresh={() => load(true)} extended />
      </div>
      <p className="text-[11px] text-fg-subtle flex items-center gap-1.5">
        <IconSettings className="w-3 h-3" />
        Keys are read from the server's environment and never returned here. "Check again" also forgets the cached tool routing and probes every MCP server afresh.
      </p>
    </div>
  );
}
