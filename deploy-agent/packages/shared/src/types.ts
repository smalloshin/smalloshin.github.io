export type ProjectStatus =
  | 'submitted'
  | 'scanning'
  | 'review_pending'
  | 'approved'
  | 'rejected'
  | 'needs_revision'
  | 'preview_deploying'
  | 'deploying'
  | 'deployed'
  | 'ssl_provisioning'
  | 'canary_check'
  | 'rolling_back'
  | 'live'
  | 'failed';

export type ScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AutoFixAction = 'auto_fix' | 'report_only';

export type ReviewDecision = 'approved' | 'rejected';

export type SourceType = 'upload' | 'git' | 'openclaw';

export type DeployTarget = 'cloud_run';

export interface Project {
  id: string;
  name: string;
  slug: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  detectedLanguage: string | null;
  detectedFramework: string | null;
  status: ProjectStatus;
  config: ProjectConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectConfig {
  deployTarget: DeployTarget;
  customDomain?: string;
  allowUnauthenticated: boolean;
  gcpProject?: string;
  gcpRegion?: string;
  gcsSourceUri?: string;  // GCS URI for uploaded source (durable across Cloud Run revisions)
  envVars?: Record<string, string>;  // User-provided env vars (merged with auto-detected)
  detectedPort?: number;             // Port detected during pipeline scan (fallback when source is gone)
  // Monorepo multi-service support
  projectGroup?: string;           // Shared group ID linking sibling services
  serviceRole?: 'backend' | 'frontend';  // Role determines deploy order & URL injection
  serviceDirName?: string;         // Original subdirectory name within monorepo
  siblings?: Array<{ name: string; role: string; dirName: string }>;
}

export interface ScanFinding {
  id: string;
  tool: 'semgrep' | 'trivy' | 'llm';
  category: string;
  severity: ScanSeverity;
  title: string;
  description: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  action: AutoFixAction;
  fix?: AutoFixResult;
}

export interface AutoFixResult {
  applied: boolean;
  diff: string;
  explanation: string;
  verificationPassed: boolean | null;
}

export interface ScanReport {
  id: string;
  projectId: string;
  version: number;
  findings: ScanFinding[];
  autoFixes: AutoFixRecord[];
  threatSummary: string;
  costEstimate: CostEstimate | null;
  resourcePlan: ResourcePlan | null;
  status: 'scanning' | 'completed' | 'failed';
  createdAt: Date;
}

export interface AutoFixRecord {
  findingId?: string;
  filePath?: string;
  originalCode?: string;
  fixedCode?: string;
  explanation: string;
  applied?: boolean;
  diff?: string;
}

// ─── Resource Requirements (LLM-detected external dependencies) ───

export type ResourceType =
  | 'redis'
  | 'postgres'
  | 'mysql'
  | 'mongodb'
  | 'object_storage'
  | 'smtp'
  | 'external_api'  // e.g. Stripe, OpenAI — user must provide their own key
  | 'unknown';

export type ResourceUseCase =
  | 'cache'
  | 'queue'           // BullMQ, Redis queue
  | 'pubsub'
  | 'session_store'
  | 'primary_database'
  | 'rate_limiting'
  | 'file_storage'
  | 'email'
  | 'payment'
  | 'ai_llm'
  | 'other';

export type ProvisioningStrategy =
  | 'auto_provision'     // deploy-agent will provision (shared Redis, Cloud SQL)
  | 'user_provided'      // user must supply the URL/key
  | 'already_configured' // env var already set by user
  | 'skip';              // not strictly needed

export interface ResourceRequirement {
  /** External service type */
  type: ResourceType;
  /** What the project uses it for */
  useCase: ResourceUseCase;
  /** Is this required for the app to start, or optional? */
  required: boolean;
  /** LLM's reasoning why this is needed (shown to user) */
  reasoning: string;
  /** Evidence from the code (import statements, env vars, etc.) */
  evidence: string[];
  /** How should this be provisioned? */
  strategy: ProvisioningStrategy;
  /** Env vars that will be set for this resource */
  envVars: Array<{
    key: string;
    description: string;
    required: boolean;
    example?: string;
  }>;
  /** Size/tier recommendation (e.g. "small", "1GB", "shared") */
  sizing?: string;
  /** Status of provisioning (filled in after provision step) */
  provisioned?: {
    success: boolean;
    providerInfo?: string;
    injectedEnvVars?: Record<string, string>;
    error?: string;
  };
}

export interface ResourcePlan {
  /** LLM-generated deployment plan summary (bilingual) */
  summary: string;
  /** List of detected resource requirements */
  requirements: ResourceRequirement[];
  /** Env vars the user still needs to provide manually */
  missingUserEnvVars: Array<{
    key: string;
    description: string;
    example?: string;
  }>;
  /** LLM provider used */
  provider: 'claude' | 'openai' | 'fallback';
  /** Can deploy proceed automatically? */
  canAutoDeploy: boolean;
  /** Blocking issues that prevent auto-deploy */
  blockers: string[];
}

export interface CostEstimate {
  monthlyTotal: number;
  breakdown: {
    compute: number;
    storage: number;
    networking: number;
    ssl: number;
  };
  currency: 'USD';
}

export interface Review {
  id: string;
  scanReportId: string;
  reviewerEmail: string | null;
  decision: ReviewDecision | null;
  comments: string | null;
  previewUrl: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface Deployment {
  id: string;
  projectId: string;
  reviewId: string | null;
  cloudRunService: string | null;
  cloudRunUrl: string | null;
  customDomain: string | null;
  sslStatus: string | null;
  terraformConfig: string | null;
  healthStatus: 'unknown' | 'healthy' | 'unhealthy' | 'rolling_back';
  canaryResults: CanaryResult | null;
  gitPrUrl: string | null;
  deployedAt: Date | null;
  createdAt: Date;
}

export interface CanaryResult {
  checks: CanaryCheck[];
  passed: boolean;
  rolledBack: boolean;
}

export interface CanaryCheck {
  type: 'http_health' | 'error_rate' | 'latency';
  passed: boolean;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface StateTransition {
  id: number;
  projectId: string;
  fromState: ProjectStatus | null;
  toState: ProjectStatus;
  triggeredBy: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
