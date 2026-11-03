export type Config = {
  engine: string;
  tools: string[];
  temperature?: number;
  maxOutputTokens?: number;
  monthlyExecutionLimit?: number;
  approvalRequired?: boolean;
  changeSummary?: string;
  name?: string;
  description?: string;
  instructions: string;
  provider: string;
  model: string;
  mascot: string;
  objective: string;
  tone: string;
  restrictions: string;
  context: string;
};
export type Draft = { config: Partial<Config>; revision: number };
export type Version = {
  createdAt: string;
  authorSubject: string | null;
  id: string;
  version: number;
  config: Partial<Config>;
};

export type TextConfigKey = Exclude<
  keyof Config,
  'temperature' | 'maxOutputTokens' | 'monthlyExecutionLimit' | 'approvalRequired' | 'tools'
>;
export type UpdateConfig = <K extends keyof Config>(key: K, value: Config[K]) => void;
