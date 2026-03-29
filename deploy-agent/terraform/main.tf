# Deploy Agent Infrastructure
# Manages the agent's own GCP resources

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.gcp_project
  region  = var.gcp_region
}

# Artifact Registry
resource "google_artifact_registry_repository" "deploy_agent" {
  location      = var.gcp_region
  repository_id = "deploy-agent"
  format        = "DOCKER"
}

# Cloud SQL (PostgreSQL)
resource "google_sql_database_instance" "deploy_agent" {
  name             = "deploy-agent-db"
  database_version = "POSTGRES_16"
  region           = var.gcp_region

  settings {
    tier = "db-f1-micro"

    ip_configuration {
      ipv4_enabled = true
    }

    backup_configuration {
      enabled = true
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "deploy_agent" {
  name     = "deploy_agent"
  instance = google_sql_database_instance.deploy_agent.name
}

resource "google_sql_user" "deploy_agent" {
  name     = "deploy_agent"
  instance = google_sql_database_instance.deploy_agent.name
  password = var.db_password
}

# Cloud Run API service
resource "google_cloud_run_v2_service" "api" {
  name     = "deploy-agent-api"
  location = var.gcp_region

  template {
    containers {
      image = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project}/deploy-agent/api:latest"

      ports {
        container_port = 4000
      }

      resources {
        limits = {
          memory = "1Gi"
          cpu    = "2"
        }
      }

      env {
        name  = "DATABASE_URL"
        value = "postgresql://${google_sql_user.deploy_agent.name}:${var.db_password}@/${google_sql_database.deploy_agent.name}?host=/cloudsql/${google_sql_database_instance.deploy_agent.connection_name}"
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }

    scaling {
      min_instance_count = 1
      max_instance_count = 5
    }
  }
}

output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "db_connection_name" {
  value = google_sql_database_instance.deploy_agent.connection_name
}
