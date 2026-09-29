import { ContactLifecycleSettings } from "./ContactLifecycleSettings";
import { SourcesEditor } from "./SourcesEditor";
import { LeadSourceRulesEditor } from "./LeadSourceRulesEditor";
import { RejectedLeadsCard } from "./RejectedLeadsCard";

export function ContactsSettingsTab() {
  return (
    <div className="space-y-6">
      <ContactLifecycleSettings />
      <SourcesEditor />
      <LeadSourceRulesEditor />
      <RejectedLeadsCard />
    </div>
  );
}
