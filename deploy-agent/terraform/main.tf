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

# ─── Shared Redis VM ──────────────────────────────────────────────────────────
# A single e2-micro VM running Redis 7 in a Docker container, shared across
# all deployed projects. Each project gets its own logical DB (0-15) allocated
# by redis-provisioner.ts.

resource "google_compute_firewall" "redis_internal" {
  name    = "shared-redis-internal"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["6379"]
  }

  # Only allow from internal IPs (Cloud Run VPC connector + GCE)
  source_ranges = ["10.0.0.0/8"]
  target_tags   = ["shared-redis"]
}

resource "google_compute_instance" "shared_redis" {
  name         = "shared-redis"
  machine_type = "e2-micro"
  zone         = var.redis_zone

  tags = ["shared-redis"]

  boot_disk {
    initialize_params {
      image = "cos-cloud/cos-stable"
      size  = 10
    }
  }

  network_interface {
    network = "default"
    access_config {
      # Ephemeral public IP — can be removed once VPC connector is set up
    }
  }

  metadata = {
    # Run Redis 7 container on boot via cloud-init on Container-Optimized OS.
    # Redis is configured with appendonly persistence and optional requirepass.
    gce-container-declaration = yamlencode({
      spec = {
        containers = [{
          name  = "redis"
          image = "redis:7-alpine"
          args  = compact([
            "redis-server",
            "--appendonly", "yes",
            "--maxmemory", "200mb",
            "--maxmemory-policy", "allkeys-lru",
            var.redis_password != "" ? "--requirepass" : "",
            var.redis_password,
          ])
          volumeMounts = [{
            name      = "redis-data"
            mountPath = "/data"
          }]
        }]
        volumes = [{
          name = "redis-data"
          hostPath = { path = "/var/lib/redis" }
        }]
        restartPolicy = "Always"
      }
    })
  }

  service_account {
    scopes = ["logging-write", "monitoring-write"]
  }
}

output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "db_connection_name" {
  value = google_sql_database_instance.deploy_agent.connection_name
}

output "shared_redis_internal_ip" {
  description = "Set this as SHARED_REDIS_HOST on the deploy-agent API service"
  value       = google_compute_instance.shared_redis.network_interface[0].network_ip
}
