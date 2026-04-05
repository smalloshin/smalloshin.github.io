# wave-deploy-agent — Infrastructure

Terraform managing all GCP resources for the agent itself.

## Files

| File | Purpose |
|------|---------|
| `versions.tf` | Terraform + provider version pins |
| `variables.tf` | All input variables |
| `backend.tf` | Remote state in GCS |
| `bootstrap.tf` | APIs, service account, IAM bindings |
| `secrets.tf` | Secret Manager entries |
| `storage.tf` | GCS Cloud Build bucket + Artifact Registry |
| `database.tf` | Cloud SQL (Postgres 16) |
| `redis.tf` | Shared Redis VM + firewall |
| `services.tf` | Cloud Run API + Web |
| `domains.tf` | Cloud Run domain mappings |
| `outputs.tf` | URLs, DNS records to create |
| `bootstrap.sh` | One-command full rebuild |

## Quick start — disaster recovery

If the agent infra is gone and you need to rebuild from scratch:

```bash
cd deploy-agent/terraform

# 1. Fill in real values
cp terraform.tfvars.example terraform.tfvars
# (edit terraform.tfvars — grab secrets from 1Password)

# 2. Run the bootstrap script
./bootstrap.sh
```

The script will:
1. Enable required GCP APIs
2. Create a GCS bucket for Terraform state (versioned)
3. `terraform init` + `plan` + `apply` (with confirmation prompts)
4. Trigger the first Cloud Build to push api + web images
5. Print DNS CNAME records you need to create in Cloudflare

**Time**: ~15–20 min end-to-end.

## Quick start — adopting existing infra (one-time)

If you already have the agent running (you do, right now) and want TF to
manage it going forward:

```bash
cd deploy-agent/terraform
cp terraform.tfvars.example terraform.tfvars
# fill in secrets from current Cloud Run env vars (see below)

# Create state bucket manually first
gsutil mb -l asia-east1 -b on gs://wave-deploy-agent-tfstate
gsutil versioning set on gs://wave-deploy-agent-tfstate

terraform init \
  -backend-config="bucket=wave-deploy-agent-tfstate" \
  -backend-config="prefix=deploy-agent"

# Import each existing resource into state (see IMPORT.md)
terraform import google_sql_database_instance.deploy_agent deploy-agent-db
terraform import google_artifact_registry_repository.deploy_agent \
  "projects/wave-deploy-agent/locations/asia-east1/repositories/deploy-agent"
# … (see IMPORT.md for full list)

# Verify no drift
terraform plan
```

## Reading existing prod secrets (one-time)

```bash
gcloud run services describe deploy-agent-api --region=asia-east1 --format=yaml \
  | grep -A1 "ANTHROPIC_API_KEY\|OPENAI_API_KEY\|GITHUB_TOKEN\|CLOUDFLARE_TOKEN\|SHARED_REDIS_PASSWORD\|DATABASE_URL"
```

Then paste into `terraform.tfvars`.

## What's NOT managed by Terraform (yet)

- **Cloudflare DNS records** — manually created, pointed to `ghs.googlehosted.com`
- **Cloud Build triggers** — currently triggered manually via `gcloud builds submit`
- **User project resources** (Cloud Run services, AR packages, Redis DBs, Postgres DBs for deployed user projects) — managed by the agent at runtime, not TF

## Security notes

- `terraform.tfvars` is gitignored. **Never commit it.**
- Secrets in Secret Manager are only readable by the `deploy-agent` service account.
- `deletion_protection = true` on Cloud SQL prevents accidental DB drops.
- GCS state bucket has versioning enabled (can restore from accidental state corruption).
