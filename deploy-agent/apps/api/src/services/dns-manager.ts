// Cloudflare DNS + Cloud Run domain mapping
// Flow: Deploy to Cloud Run → domain mapping (ghs.googlehosted.com) → CNAME in Cloudflare

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const CF_API = 'https://api.cloudflare.com/client/v4';

export interface DnsConfig {
  cloudflareToken: string;
  zoneId: string;
  subdomain: string;    // e.g. "kol-studio"
  zoneName: string;     // e.g. "punwave.com"
}

export interface DnsResult {
  success: boolean;
  fqdn: string;         // e.g. "kol-studio.punwave.com"
  recordId: string | null;
  error: string | null;
}

interface CfResponse<T = unknown> {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T;
}

async function cfFetch<T = unknown>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<CfResponse<T>> {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res.json() as Promise<CfResponse<T>>;
}

// ─── List zones accessible by token ───

export async function listZones(token: string): Promise<{ id: string; name: string }[]> {
  const data = await cfFetch<{ id: string; name: string }[]>('/zones', token);
  if (!data.success) throw new Error(`Cloudflare zones error: ${data.errors[0]?.message}`);
  return data.result;
}

// ─── Find existing DNS record ───

async function findRecord(
  config: DnsConfig,
  fqdn: string
): Promise<{ id: string; content: string } | null> {
  const data = await cfFetch<{ id: string; content: string }[]>(
    `/zones/${config.zoneId}/dns_records?type=CNAME&name=${fqdn}`,
    config.cloudflareToken
  );
  if (!data.success || data.result.length === 0) return null;
  return data.result[0];
}

// ─── Create or update CNAME record (DNS-only, no proxy) ───

export async function upsertCname(
  config: DnsConfig,
  target: string,
  proxied = false
): Promise<DnsResult> {
  const fqdn = `${config.subdomain}.${config.zoneName}`;

  try {
    const existing = await findRecord(config, fqdn);

    if (existing) {
      if (existing.content === target) {
        console.log(`  DNS: ${fqdn} already points to ${target}`);
        return { success: true, fqdn, recordId: existing.id, error: null };
      }

      const data = await cfFetch<{ id: string }>(
        `/zones/${config.zoneId}/dns_records/${existing.id}`,
        config.cloudflareToken,
        {
          method: 'PATCH',
          body: JSON.stringify({
            type: 'CNAME',
            name: config.subdomain,
            content: target,
            proxied,
            ttl: 1,
          }),
        }
      );
      if (!data.success) {
        return { success: false, fqdn, recordId: null, error: data.errors[0]?.message ?? 'Update failed' };
      }
      console.log(`  DNS: Updated ${fqdn} → ${target}`);
      return { success: true, fqdn, recordId: data.result.id, error: null };
    }

    const data = await cfFetch<{ id: string }>(
      `/zones/${config.zoneId}/dns_records`,
      config.cloudflareToken,
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'CNAME',
          name: config.subdomain,
          content: target,
          proxied,
          ttl: 1,
        }),
      }
    );
    if (!data.success) {
      return { success: false, fqdn, recordId: null, error: data.errors[0]?.message ?? 'Create failed' };
    }
    console.log(`  DNS: Created ${fqdn} → ${target}`);
    return { success: true, fqdn, recordId: data.result.id, error: null };
  } catch (err) {
    return { success: false, fqdn, recordId: null, error: (err as Error).message };
  }
}

// ─── Delete DNS record ───

export async function deleteCname(config: DnsConfig): Promise<{ success: boolean; error: string | null }> {
  const fqdn = `${config.subdomain}.${config.zoneName}`;
  try {
    const existing = await findRecord(config, fqdn);
    if (!existing) {
      return { success: true, error: null };
    }

    const data = await cfFetch(
      `/zones/${config.zoneId}/dns_records/${existing.id}`,
      config.cloudflareToken,
      { method: 'DELETE' }
    );
    if (!data.success) {
      return { success: false, error: data.errors[0]?.message ?? 'Delete failed' };
    }
    console.log(`  DNS: Deleted ${fqdn}`);
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Cloud Run domain mapping ───

async function createDomainMapping(
  gcpProject: string,
  gcpRegion: string,
  serviceName: string,
  domain: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    await execFileAsync('gcloud', [
      'beta', 'run', 'domain-mappings', 'create',
      '--service', serviceName,
      '--domain', domain,
      '--region', gcpRegion,
      '--project', gcpProject,
      '--quiet',
    ], { timeout: 120 * 1000 });
    return { success: true, error: null };
  } catch (err) {
    const msg = (err as Error).message;
    // Already mapped is not an error
    if (msg.includes('already mapped') || msg.includes('already exists')) {
      return { success: true, error: null };
    }
    return { success: false, error: msg };
  }
}

// ─── Full custom domain setup ───
// 1. Cloud Run domain mapping → tells GCP to accept traffic for this hostname
// 2. Cloudflare CNAME → ghs.googlehosted.com (Google's domain mapping endpoint)
// 3. Google provisions SSL cert automatically

export async function setupCustomDomainWithDns(
  config: DnsConfig,
  _cloudRunUrl: string,
  gcpProject: string,
  gcpRegion: string,
  serviceName: string
): Promise<{ success: boolean; customUrl: string; error: string | null }> {
  const fqdn = `${config.subdomain}.${config.zoneName}`;

  console.log(`\n  Setting up custom domain: ${fqdn}`);

  // Step 1: Cloud Run domain mapping
  console.log('  Step 1: Cloud Run domain mapping...');
  const mappingResult = await createDomainMapping(gcpProject, gcpRegion, serviceName, fqdn);
  if (!mappingResult.success) {
    return { success: false, customUrl: '', error: `Domain mapping failed: ${mappingResult.error}` };
  }
  console.log('  Domain mapping: OK');

  // Step 2: Cloudflare CNAME → ghs.googlehosted.com (DNS-only, no proxy)
  // Cloud Run handles SSL via managed Google certs.
  // Cloudflare proxy must be OFF so Google can verify domain ownership and provision the cert.
  console.log('  Step 2: Cloudflare CNAME → ghs.googlehosted.com...');
  const dnsResult = await upsertCname(config, 'ghs.googlehosted.com', false);
  if (!dnsResult.success) {
    return { success: false, customUrl: '', error: `DNS failed: ${dnsResult.error}` };
  }

  console.log(`  ${fqdn} → ghs.googlehosted.com (DNS-only, SSL by Google managed cert)`);
  console.log('  Note: SSL cert provisioning takes 5-15 minutes on first setup');

  return { success: true, customUrl: `https://${fqdn}`, error: null };
}
