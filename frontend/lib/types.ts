export type Option = {
  value: string;
  label: string;
};

export type Question = {
  id: string;
  text: string;
  options: Option[];
  category: string;
};

export type CategoryNotes = {
  profile: string;
  communication: string;
  action: string;
  mind: string;
};

export type DiagnoseResponse = {
  score: number;
  headline: string;
  summary?: string;
  bullets: string[];
  nextActions?: string[];
  categoryNotes?: CategoryNotes;
  messageExample?: string;
  shareText: string;
  sharePath: string;
};
