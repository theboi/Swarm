import { createContext } from "react";

// Only local presentation choices survive DOM offloading; no server entities live here.
export const TranscriptViewPreferences = createContext<Map<
  string,
  { expanded: boolean; renderMarkdown: boolean }
> | null>(null);
