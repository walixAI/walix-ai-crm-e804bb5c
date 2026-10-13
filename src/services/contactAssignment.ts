import { supabase } from "@/integrations/supabase/client";
export async function reassignContact(contactId: string, ownerId: string | null) {
  const { error } = await supabase.rpc("reassign_contact_atomic", { p_contact_id: contactId, p_new_owner_id: ownerId });
  if (error) throw error;
}
