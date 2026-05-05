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

export type DiagnoseResponse = {
  score: number;
  headline: string;
  bullets: string[];
  shareText: string;
  sharePath: string;
};
