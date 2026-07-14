# TizenBrew IPTV QR Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Cloudflare Worker relay that lets a phone submit an M3U URL to a TV app by scanning a QR code.

**Architecture:** The Worker exposes a phone setup HTML form and two JSON endpoints. TV app will later generate a device code, show `/setup?code=...`, poll `/api/config?code=...`, then save the returned playlist URL in localStorage.

**Tech Stack:** Cloudflare Workers, KV, TypeScript, Vitest.

---

### Task 1: Worker Relay

**Files:**
- Create: `workers/tizenbrew-iptv-setup/src/index.ts`
- Create: `workers/tizenbrew-iptv-setup/test/index.test.ts`
- Create: `workers/tizenbrew-iptv-setup/wrangler.toml`
- Create: `workers/tizenbrew-iptv-setup/README.md`

- [x] Write endpoint tests for setup page, validation, storing, reading, and pending status.
- [x] Run tests red before implementation.
- [x] Implement Worker endpoints.
- [x] Run tests green.
- [ ] Deploy Worker and provide URL.
- [ ] Wire TV app to Worker URL and publish `tizenbrew-iptv`.
