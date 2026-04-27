import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, type Role } from "@/store/auth";

export function useInitAuth() {
  const { setSession, setRoles, setLoading } = useAuthStore();

  useEffect(() => {
    // 1. Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        // defer DB call to avoid deadlock
        setTimeout(async () => {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id);
          setRoles((data ?? []).map((r) => r.role as Role));
        }, 0);
      } else {
        setRoles([]);
      }
    });

    // 2. Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .then(({ data }) => {
            setRoles((data ?? []).map((r) => r.role as Role));
          });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [setSession, setRoles, setLoading]);
}

export function useAuth() {
  return useAuthStore();
}