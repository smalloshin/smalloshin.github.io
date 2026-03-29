---
name: deploy
description: Submit, scan, review, and deploy vibe-coded projects to GCP Cloud Run with security scanning and auto-fix.
---

# /deploy — Secure Deploy Agent

Submit vibe-coded projects for security scanning, auto-fix, human review, and deployment to GCP Cloud Run.

## Commands

### Submit a project
```bash
curl -s -X POST http://localhost:4000/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"PROJECT_NAME","sourceType":"SOURCE_TYPE","sourceUrl":"URL_OR_PATH"}'
```

Source types: `upload`, `git`, `openclaw`

### Check project status
```bash
curl -s http://localhost:4000/api/projects/PROJECT_ID
```

### List all projects
```bash
curl -s http://localhost:4000/api/projects
```

### Get scan report
```bash
curl -s http://localhost:4000/api/projects/PROJECT_ID/scan
```

### Approve deployment
```bash
curl -s -X POST http://localhost:4000/api/reviews/REVIEW_ID/decide \
  -H 'Content-Type: application/json' \
  -d '{"decision":"approved","reviewerEmail":"you@example.com","comments":"LGTM"}'
```

### Reject deployment
```bash
curl -s -X POST http://localhost:4000/api/reviews/REVIEW_ID/decide \
  -H 'Content-Type: application/json' \
  -d '{"decision":"rejected","reviewerEmail":"you@example.com","comments":"Fix the hardcoded secrets"}'
```

## MCP Integration

The agent exposes an MCP endpoint at `/mcp/tools/list` and `/mcp/tools/call`.

Available MCP tools:
- `submit_project` — Submit a project for scanning
- `get_project_status` — Check project status
- `list_projects` — List all projects
- `get_scan_report` — Get security scan report
- `approve_deploy` — Approve for deployment
- `reject_deploy` — Reject with feedback
- `get_deploy_status` — Check deployment health
- `rollback_deploy` — Rollback to previous version

## Pipeline

1. Project Detection (language, framework)
2. Dockerfile Generation (if missing)
3. SAST Scan (Semgrep)
4. SCA Scan (Trivy)
5. LLM Threat Analysis (Claude)
6. Auto-Fix + Verification
7. Review Report Generation
8. Cost Estimation
9. Preview Deploy
10. **Human Review Gate**
11. Production Deploy (Cloud Run + SSL)
12. Canary Health Checks
13. Git PR with security fixes
