// Shapes from postman/specs/director-api.yaml (DirectorApp API 0.3.0).

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type Role = 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  role: Role;
}

export interface App {
  id: number;
  name: string;
  description: string;
  policy: number | null;
  created_at: string;
}

export interface AppWrite {
  name: string;
  description: string;
  policy: number | null;
}

export interface AppBrief {
  id: number;
  name: string;
}

export type Combination = Record<string, unknown>;

export interface Rule {
  id: number;
  name: string;
  description: string;
  combination: Combination;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleWrite {
  name: string;
  description: string;
  combination: Combination;
  is_active: boolean;
}

export type RuleValueType = 'number' | 'time' | 'datetime' | 'bool';

export interface RuleField {
  name: string;
  type: RuleValueType;
  nullable: boolean;
  description: string | null;
}

export interface RuleOperator {
  op: string;
  kind: 'logic' | 'comparison' | 'membership' | 'arithmetic';
  symbol: string;
  types: RuleValueType[];
}

export interface RuleCatalog {
  fields: RuleField[];
  operators: RuleOperator[];
}

export type PolicyOperator = 'and' | 'or';

export interface PolicyRuleLink {
  rule: { id: number; name: string; is_active: boolean };
  is_active: boolean;
  effective: boolean;
}

export interface Policy {
  id: number;
  name: string;
  description: string;
  operator: PolicyOperator;
  is_active: boolean;
  max_concurrent_jobs: number | null;
  apps_count: number;
  rules: PolicyRuleLink[];
  created_at: string;
  updated_at: string;
}

export interface PolicyWrite {
  name: string;
  description: string;
  operator: PolicyOperator;
  is_active: boolean;
  max_concurrent_jobs: number | null;
  rules: { rule: number; is_active: boolean }[];
}

export const JOB_STATUSES = ['queued', 'in-process', 'success', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface Job {
  id: number;
  app: number | null;
  model: string;
  data: string[];
  prompt: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface JobWrite {
  app: number | null;
  model: string;
  data: string[];
  prompt: string;
  status: JobStatus;
}

export interface EnergySnapshot {
  id: number;
  timestamp: string;
  solar_power_w: number;
  load_power_w: number;
  grid_power_w: number;
  battery_power_w: number;
  battery_charge_pct: number;
  battery_voltage_v: number;
  grid_voltage_v: number;
  pv1_voltage_v: number | null;
  pv1_current_a: number | null;
  pv1_power_w: number | null;
  pv2_voltage_v: number | null;
  pv2_current_a: number | null;
  pv2_power_w: number | null;
  battery_max_charge_current_a: number | null;
}

export interface AppEvaluation {
  can_run: boolean;
  energy: EnergySnapshot;
  policy: {
    policy: number;
    operator: PolicyOperator;
    passed: boolean;
    rules: { rule: number; name: string; passed: boolean }[];
  } | null;
}
