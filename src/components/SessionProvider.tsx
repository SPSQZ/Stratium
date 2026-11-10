"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { UserRole } from "@/lib/types";

export interface SessionData {
  session: {
    company: {
      id: string;
      slug: string;
      name: string;
      currency: string;
      historicalCutoffDate: string | null;
      isHistoricalDemo: boolean;
      syntheticDataNotice: string | null;
      recordedCashBalance: number;
      recordedBalanceSource: string;
    };
    user: {
      id: string;
      companyId: string;
      departmentId: string | null;
      departmentName: string | null;
      departmentCode: string | null;
      name: string;
      email: string;
      title: string;
      role: UserRole;
      isDemoAccount: boolean;
    };
  };
  companies: Array<{
    id: string;
    slug: string;
    name: string;
    industry: string;
    isHistoricalDemo: boolean;
    historicalCutoffDate: string | null;
    currency: string;
  }>;
  companyUsers: Array<{
    id: string;
    name: string;
    email: string;
    title: string;
    role: UserRole;
    departmentId: string | null;
    departmentName: string | null;
    isDemoAccount: boolean;
  }>;
  notifications: {
    pendingApprovals: Array<{
      id: string;
      title: string;
      amount: number;
      status: string;
    }>;
    dueInvoices: Array<{
      id: string;
      invoiceNumber: string;
      counterpartyName: string;
      amount: number;
      paidAmount: number;
      dueDate: string;
      direction: string;
    }>;
    upcomingReviews: Array<{
      id: string;
      title: string;
      estimatedCost: number;
    }>;
    totalCount: number;
  };
  integrations: {
    llmMode: string;
    paypalConfigured: boolean;
    paypalPayoutsEnabled: boolean;
    paypalEnv: string;
  };
}

interface SessionContextValue {
  data: SessionData | null;
  loading: boolean;
  revision: number;
  refreshSession: () => Promise<void>;
  switchWorkspaceOrUser: (params: {
    companyId?: string;
    userId?: string;
  }) => Promise<void>;
}

const SessionCtx = createContext<SessionContextValue>({
  data: null,
  loading: true,
  revision: 0,
  refreshSession: async () => {},
  switchWorkspaceOrUser: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as SessionData;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const switchWorkspaceOrUser = useCallback(
    async (params: { companyId?: string; userId?: string }) => {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        await refreshSession();
        setRevision((r) => r + 1);
      }
    },
    [refreshSession]
  );

  return (
    <SessionCtx.Provider
      value={{
        data,
        loading,
        revision,
        refreshSession,
        switchWorkspaceOrUser,
      }}
    >
      {children}
    </SessionCtx.Provider>
  );
}

export function useSession() {
  return useContext(SessionCtx);
}

