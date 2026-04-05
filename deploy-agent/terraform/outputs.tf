output "api_url" {
  description = "Cloud Run auto-generated URL for the API"
  value       = google_cloud_run_v2_service.api.uri
}

output "web_url" {
  description = "Cloud Run auto-generated URL for the Web UI"
  value       = google_cloud_run_v2_service.web.uri
}

output "db_connection_name" {
  description = "Cloud SQL connection name (used in DATABASE_URL socket path)"
  value       = google_sql_database_instance.deploy_agent.connection_name
}

output "shared_redis_internal_ip" {
  description = "Internal IP for shared Redis VM"
  value       = google_compute_instance.shared_redis.network_interface[0].network_ip
}

output "agent_service_account" {
  description = "Runtime service account email"
  value       = google_service_account.agent.email
}

output "dns_records_to_create" {
  description = "CNAME records to create in Cloudflare (or other DNS)"
  value = {
    (var.api_domain) = "ghs.googlehosted.com."
    (var.web_domain) = "ghs.googlehosted.com."
  }
}
