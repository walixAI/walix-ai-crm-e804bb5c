import { StagesEditor } from "./StagesEditor";
import { SourcesEditor } from "./SourcesEditor";

export function ContactsSettingsTab() {
  return (
    <div className="space-y-6">
      <StagesEditor />
      <SourcesEditor />
    </div>
  );
}