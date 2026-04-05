# All sensitive values live in Secret Manager, referenced by Cloud Run via
# value_source.secret_key_ref. Values come from terraform.tfvars (gitignored).

locals {
  secrets = {
    db-password         = var.db_password
    redis-password      = var.redis_password
    anthropic-api-key   = var.anthropic_api_key
    openai-api-key      = var.openai_api_key
    github-token        = var.github_token
    cloudflare-token    = var.cloudflare_token
  }
}

resource "google_secret_manager_secret" "secrets" {
  for_each  = local.secrets
  secret_id = each.key

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret_version" "versions" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.secrets[each.key].id
  secret_data = each.value
}

# Grant runtime SA access to all secrets
resource "google_secret_manager_secret_iam_member" "agent_access" {
  for_each  = local.secrets
  secret_id = google_secret_manager_secret.secrets[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.agent.email}"
}
