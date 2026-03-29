variable "gcp_project" {
  description = "GCP project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "asia-east1"
}

variable "db_password" {
  description = "Database password for deploy_agent user"
  type        = string
  sensitive   = true
}
