import type { Change } from "./domain.js";
export type Trace = { tool: string; summary: string };
export type Proposal = {
  id: string;
  change: Change;
  version: number;
  patientId?: string;
  expiresAt: string;
  state: "pending" | "approved" | "rejected";
};
export type AssistantResult = {
  message: string;
  trace: Trace[];
  proposal?: Proposal;
  model: string;
  inputTokens: number;
  outputTokens: number;
};
