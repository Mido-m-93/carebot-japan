"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { API_URL, supabase } from "@/lib/supabase";

export interface Location {
  clinic_id: string;
  name: string;
  name_jp: string | null;
  slug: string | null;
  is_primary: boolean;
  role: "owner" | "staff";
  active: boolean;
}

interface ClinicContextValue {
  locations: Location[];
  activeClinicId: string | null;
  setActiveClinicId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ClinicContext = createContext<ClinicContextValue>({
  locations: [],
  activeClinicId: null,
  setActiveClinicId: () => {},
  loading: true,
  refresh: async () => {},
});

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeClinicId, setActiveClinicIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(`${API_URL}/clinics/locations`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = res.ok ? await res.json() : [];
      const list: Location[] = Array.isArray(data) ? data : [];
      setLocations(list);

      setActiveClinicIdState((prev) => {
        if (prev && list.some((l) => l.clinic_id === prev)) return prev;
        const saved = localStorage.getItem("carebot_active_clinic_id");
        const match = list.find((l) => l.clinic_id === saved);
        return match ? match.clinic_id : list[0]?.clinic_id ?? null;
      });
    } catch {
      setLocations([]);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  function setActiveClinicId(id: string) {
    setActiveClinicIdState(id);
    localStorage.setItem("carebot_active_clinic_id", id);
  }

  return (
    <ClinicContext.Provider value={{ locations, activeClinicId, setActiveClinicId, loading, refresh }}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinicContext() {
  return useContext(ClinicContext);
}
