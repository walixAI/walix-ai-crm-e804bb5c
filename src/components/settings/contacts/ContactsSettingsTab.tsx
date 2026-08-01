import { ContactLifecycleSettings } from "./ContactLifecycleSettings";
import { SourcesEditor } from "./SourcesEditor";

export function ContactsSettingsTab() {
  return (
    <div className="space-y-6">
      <ContactLifecycleSettings />
      <SourcesEditor />
    </div>
  );
}
