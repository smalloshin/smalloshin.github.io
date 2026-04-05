# SESSION HANDOFF — wave-deploy-agent

> 每次新對話開始時讀這份檔案，結束前更新它。

## 上次進度（Last Progress）

**2026-04-05（深夜）**

- ✅ Terraform DR 系統：9 個 .tf 檔 + `bootstrap.sh` + `README.md` + `terraform.tfvars.example`
  - 涵蓋：APIs、dedicated SA+IAM、Secret Manager（6 secrets）、GCS+lifecycle、AR+cleanup、Cloud SQL（backup+PITR+deletion_protection）、Redis VM、Cloud Run api+web（secrets 由 Secret Manager 注入）、domain mappings
  - Remote state 在 `${project}-tfstate` GCS bucket（versioned）
  - **尚未跑過**：需在 throwaway project 驗證
- ⚠️ **發現安全問題**：現 prod Cloud Run env vars 有 6 個明文 secrets（Anthropic/OpenAI keys、GitHub PAT、Cloudflare token、DB password、Redis password）→ TF 已把它們全部搬到 Secret Manager，但 live prod 還沒 migrate
- ✅ 第 3 份 decision 檔：`2026-04-05-terraform-disaster-recovery.md`

**2026-04-05（晚上）**

- ✅ Dashboard 新增「基礎設施」頁（`/infra`）
  - Artifact Registry（repo 大小、cleanup policy 狀態、每 package 版本數）
  - Cloud Storage（sources/ bucket 統計、lifecycle rule 狀態）
  - Cloud Run（agent 自身 services 狀態 + Ready 燈號）
- ✅ 孤兒資源清理：橫幅顯示 orphan count + 一鍵清理（POST /api/infra/cleanup-orphans）
- ✅ 3 個新 API endpoints：`/api/infra/overview`, `/api/infra/orphans`, `/api/infra/cleanup-orphans`
- ✅ 修 bug：Cloud Run v2 API ready 狀態要讀 `terminalCondition` 不是 `conditions[]`
- ✅ 驗證 on https://wave-deploy-agent.punwave.com/infra：39 個 orphan tarball (9.9 MB) + 1 orphan AR package (`deploy-agent-api` 舊命名) 已偵測到

**2026-04-05（下午）**

- ✅ 建立 brain 會話管理系統（CLAUDE.md + SESSION_HANDOFF.md + decisions/index.md）
- ✅ GCS sources lifecycle：30 天自動刪除已套用（bucket: `wave-deploy-agent_cloudbuild`, prefix: `sources/`）
- ✅ Artifact Registry cleanup policy：keep 5 tagged + 清 7d untagged / 30d tagged
- ✅ 2 份 decision 檔：`2026-04-05-gcs-sources-lifecycle-30d.md`, `2026-04-05-artifact-registry-cleanup.md`

**2026-04-05（上午）**

- ✅ Dashboard 重構：從平面表格改為「專案 → 資源」的可展開 accordion
  - 新 API：`GET /api/project-groups`、`POST /api/project-groups/:groupId/actions`
  - 每個專案卡片顯示所有 allocated resources（Cloud Run、Redis、Postgres、Source archive）
  - 支援 bulk stop/start/delete（monorepo 可整組操作或選子集）
- ✅ 新增 `stop/start` 生命週期（GCP convention：stop = deleteService，start = 從 Artifact Registry 快取 image 重部署）
  - 停止前 snapshot image URI + envVars 到 `project.config`，確保 start 可還原
  - 有 REDIS_URL 時自動啟用 Direct VPC egress
- ✅ Source tarball 保留 + 下載：service account proxy 從 GCS 下載原始碼
- ✅ 修掉三個 bug：
  1. `--no-allow-unauthenticated` 把 IAM 炸掉 → 改成 `--allow-unauthenticated`
  2. `NEXT_PUBLIC_API_URL` 沒 bake 進 build → cloudbuild.yaml 加 build-arg
  3. 舊專案沒有 `lastDeployedImage` → stop 時從 live service 讀取並快取
- ✅ 端到端測試通過：luca-backend 停止→重啟，36 個 envVars 全部還原

## 待辦事項（TODO）

### 高優先
- [x] ~~**GCS lifecycle rule**：為 `gs://wave-deploy-agent_cloudbuild/sources/` 設 30 天自動刪除~~（2026-04-05 完成，見 `decisions/2026-04-05-gcs-sources-lifecycle-30d.md`）
- [x] ~~**Artifact Registry cleanup**~~（2026-04-05 完成：keep 5 tagged + 清 7d untagged / 30d tagged，見 `decisions/2026-04-05-artifact-registry-cleanup.md`）
- [x] ~~**Dashboard GCP 資源管理頁**~~（2026-04-05 完成：`/infra` 頁 + orphan cleanup 一鍵清理）
- [ ] **執行 orphan cleanup**：首次清理 39 個 tarball + 1 AR package（用 dashboard 按鈕即可）
- [ ] **驗證 bootstrap.sh**：在 throwaway GCP project 跑一次完整 `./terraform/bootstrap.sh`
- [ ] **migrate prod secrets 到 Secret Manager**：目前 6 個 keys 是明文 env vars，高風險
- [ ] **Terraform import 現有 prod 資源**：寫 `terraform/IMPORT.md` 並執行，讓 TF 實際管住現況（消除 drift risk）

### 中優先
- [ ] Terraform for agent 自身 infra（目前是手動 gcloud deploy）
- [ ] Dashboard i18n（next-intl 中英雙語）— design spec 已訂
- [ ] MCP server 實作（`@modelcontextprotocol/sdk`）
- [ ] OpenClaw skill（`skills/deploy-agent/SKILL.md`）

### 低優先 / Phase 3+
- [ ] Canary monitor + auto-rollback
- [ ] IaC auto-generation（為使用者的專案產 Terraform）
- [ ] Cost estimation（GCP pricing API）
- [ ] Git PR 自動化（security fix diffs）

## 重要資訊 / 重要關注（Important Notes）

### 架構
- **部署位置**：asia-east1，GCP project = `wave-deploy-agent`
- **Agent 網址**：
  - API: `https://wave-deploy-agent-api.punwave.com` → `deploy-agent-api` Cloud Run
  - Web: `https://deploy-agent-web-zdjl362voq-de.a.run.app`（尚未綁 custom domain）
- **Artifact Registry**：`asia-east1-docker.pkg.dev/wave-deploy-agent/deploy-agent/{api,web,<user-slug>}`
- **DB**：Cloud SQL（PostgreSQL）shared instance
- **CI/CD**：`cloudbuild.yaml`，push 到 main 觸發

### 坑點（踩過的雷）
1. **Cloud Run deploy 務必加 `--allow-unauthenticated`**，否則 IAM binding 會被清掉，API 變成 503
2. **Next.js `NEXT_PUBLIC_*` 環境變數必須 build 時 bake**，runtime 設沒用 → cloudbuild.yaml 要用 `--build-arg`
3. **GCP 沒有 Cloud Run pause**，唯一真正釋放資源的方式是 delete service；start 靠快取 image 重 deploy
4. **有 REDIS_URL 的專案必須啟 Direct VPC egress**，否則連不到 internal Redis

### 使用者偏好（Boss 習慣）
- 直接給結論、不要囉嗦
- 跟 GCP convention 一致就好，不用自己發明
- 遇到 gcloud 找不到：路徑在 `/usr/local/share/google-cloud-sdk/bin/gcloud`
- 驗證 UI 時用 Chrome MCP 截圖

### 資源盤點（2026-04-05）
- Cloud Run services：只剩 `deploy-agent-api` + `deploy-agent-web`（使用者自己的專案都已清掉）
- GCS sources：61 個 tarball / 12.91 MiB（含歷史：bid-ops, kol-studio, luca-*, wave-test 等）
- Artifact Registry：api image 37+ 版本未清
