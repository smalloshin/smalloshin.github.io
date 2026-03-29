import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface DeployConfig {
  projectSlug: string;
  gcpProject: string;
  gcpRegion: string;
  imageName: string;
  imageTag: string;
  envVars: Record<string, string>;
  memory?: string;
  cpu?: string;
  minInstances?: number;
  maxInstances?: number;
  allowUnauthenticated?: boolean;
  port?: number;
}

export interface DeployResult {
  success: boolean;
  serviceUrl: string | null;
  serviceName: string;
  error: string | null;
  duration: number;
}

export async function buildAndPushImage(
  projectDir: string,
  config: DeployConfig
): Promise<{ success: boolean; imageUri: string; error: string | null }> {
  const imageUri = `${config.gcpRegion}-docker.pkg.dev/${config.gcpProject}/deploy-agent/${config.imageName}:${config.imageTag}`;

  try {
    // Build with Cloud Build (sandboxed)
    await execFileAsync('gcloud', [
      'builds', 'submit',
      '--project', config.gcpProject,
      '--region', config.gcpRegion,
      '--tag', imageUri,
      '--timeout', '600s',
      '--quiet',
      projectDir,
    ], { timeout: 10 * 60 * 1000 });

    return { success: true, imageUri, error: null };
  } catch (err) {
    return { success: false, imageUri, error: (err as Error).message };
  }
}

export async function deployToCloudRun(config: DeployConfig, imageUri: string): Promise<DeployResult> {
  const start = Date.now();
  const serviceName = `da-${config.projectSlug}`.slice(0, 63);

  const args = [
    'run', 'deploy', serviceName,
    '--project', config.gcpProject,
    '--region', config.gcpRegion,
    '--image', imageUri,
    '--memory', config.memory ?? '512Mi',
    '--cpu', config.cpu ?? '1',
    '--min-instances', String(config.minInstances ?? 0),
    '--max-instances', String(config.maxInstances ?? 10),
    '--port', String(config.port ?? 3000),
    '--platform', 'managed',
    '--quiet',
    '--format', 'json',
  ];

  // Set env vars
  const envPairs = Object.entries(config.envVars).map(([k, v]) => `${k}=${v}`);
  if (envPairs.length > 0) {
    args.push('--set-env-vars', envPairs.join(','));
  }

  // Auth setting
  if (config.allowUnauthenticated) {
    args.push('--allow-unauthenticated');
  } else {
    args.push('--no-allow-unauthenticated');
  }

  try {
    const { stdout } = await execFileAsync('gcloud', args, { timeout: 5 * 60 * 1000 });
    const result = JSON.parse(stdout);
    const serviceUrl = result.status?.url ?? null;

    return {
      success: true,
      serviceUrl,
      serviceName,
      error: null,
      duration: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      serviceUrl: null,
      serviceName,
      error: (err as Error).message,
      duration: Date.now() - start,
    };
  }
}

export async function deployPreview(
  config: DeployConfig,
  imageUri: string
): Promise<DeployResult> {
  const previewTag = `preview-${Date.now()}`;
  const previewConfig = {
    ...config,
    projectSlug: `${config.projectSlug}-preview`,
    maxInstances: 1,
    minInstances: 0,
  };
  return deployToCloudRun(previewConfig, imageUri);
}

export async function deleteService(
  gcpProject: string,
  gcpRegion: string,
  serviceName: string
): Promise<void> {
  try {
    await execFileAsync('gcloud', [
      'run', 'services', 'delete', serviceName,
      '--project', gcpProject,
      '--region', gcpRegion,
      '--quiet',
    ], { timeout: 60 * 1000 });
  } catch (err) {
    console.error(`Failed to delete service ${serviceName}:`, (err as Error).message);
  }
}

export async function rollbackService(
  gcpProject: string,
  gcpRegion: string,
  serviceName: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Get revisions, roll back to previous
    const { stdout } = await execFileAsync('gcloud', [
      'run', 'revisions', 'list',
      '--service', serviceName,
      '--project', gcpProject,
      '--region', gcpRegion,
      '--format', 'json',
      '--limit', '2',
    ], { timeout: 30 * 1000 });

    const revisions = JSON.parse(stdout);
    if (revisions.length < 2) {
      return { success: false, error: 'No previous revision to roll back to' };
    }

    const previousRevision = revisions[1].metadata.name;
    await execFileAsync('gcloud', [
      'run', 'services', 'update-traffic', serviceName,
      '--project', gcpProject,
      '--region', gcpRegion,
      '--to-revisions', `${previousRevision}=100`,
      '--quiet',
    ], { timeout: 30 * 1000 });

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function setupCustomDomain(
  gcpProject: string,
  gcpRegion: string,
  serviceName: string,
  domain: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    await execFileAsync('gcloud', [
      'run', 'domain-mappings', 'create',
      '--service', serviceName,
      '--domain', domain,
      '--project', gcpProject,
      '--region', gcpRegion,
      '--quiet',
    ], { timeout: 60 * 1000 });

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
