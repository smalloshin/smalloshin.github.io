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

variable "redis_password" {
  description = "Password for shared Redis instance (empty disables auth)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "redis_zone" {
  description = "GCP zone for shared Redis VM"
  type        = string
  default     = "asia-east1-b"
}
