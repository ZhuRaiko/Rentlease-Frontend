import {useState} from 'react';
import {initialPreferenceSection, rankingTabs, toggleSection, type PreferenceSection} from '../models/MatchingPreferenceForm';

/** Screen-only state of the Matching preferences form: which card is open and which ranking tab is showing. The preferences themselves live in the Discovery view model. */
export function useMatchingPreferencesForm() {
  const [open, setOpen] = useState<PreferenceSection | null>(initialPreferenceSection);
  const [tabId, setTabId] = useState(rankingTabs[0]!.id);
  return {
    open,
    toggle: (id: PreferenceSection) => setOpen(current => toggleSection(current, id)),
    show: (id: PreferenceSection) => setOpen(id),
    tab: rankingTabs.find(tab => tab.id === tabId) ?? rankingTabs[0]!,
    setTab: setTabId,
  };
}
