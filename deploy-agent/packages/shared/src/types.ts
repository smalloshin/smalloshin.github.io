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
  threatSummary: string;
  costEstimate: CostEstimate | null;
  status: 'scanning' | 'completed' | 'failed';
  createdAt: Date;
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
