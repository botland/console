# REFACTO — appliance-console

Production-code refactoring guide for the InferEdge management console. Scope: `app/`, `lib/`, `components/`, `schemas/`. Excludes `tests/`.

---

## Executive summary

| Category | High | Medium | Low |
|----------|------|--------|-----|
| Code duplication | 3 themes | 12 | 10 |
| Hardcoded values | 2 | 5 | 3 |
| Poor design | 3 | 4 | 3 |
| Cross-layer (`lib` ↔ `app`) | — | 5 | 2 |

Highest-impact issues: **dual mock/inferedge runtime backends**, **magic appliance state strings without a single source of truth**, and **god files** (`mock/store.ts`, `DeploymentForm.tsx`, orchestration page).

---

## Disk space

Measured share of the ownedge workspace (~1.2 GB total):

| Path | Size | Category |
|------|------|----------|
| `node_modules/` | ~597 MB | npm dependencies (gitignored, regenerable) |
| `.next/` | ~170 MB | Next.js build output + cache (gitignored) |
| `app/` + `lib/` + `components/` | ~484 KB | TypeScript source |
| `tsconfig.tsbuildinfo` | ~136 KB | Incremental build cache |

**~99% of appliance-console disk is build artifacts**, not source code.

Safe cleanup:

```bash
rm -rf node_modules .next tsconfig.tsbuildinfo
npm ci && npm run build   # regenerate when needed
```

Ensure `.gitignore` keeps these out of git (already configured). CI should cache `node_modules` rather than committing it.

---

## 1. Code duplication

### 1.1 Dual runtime implementations (mock vs inferedge) — HIGH

Nearly every data operation exists twice, bridged by `lib/runtime/index.ts` with `isInferedgeRuntime() ? inferedge.* : mock.*` on ~20 functions (27 call sites across `index.ts` and `mode.ts`).

| Concern | Mock | Inferedge |
|---------|------|-----------|
| CRUD (config, deployments, nodes, storage) | `lib/mock/store.ts` (~639 lines) | `lib/runtime/inferedge.ts` (~376 lines) |
| Orchestration (join/detach/migrate) | `lib/mock/store.ts` | `lib/runtime/inferedge.ts` |
| Gateway info | `lib/mock/store.ts` | `lib/runtime/inferedge.ts` |

**Action:** Define a `RuntimeBackend` interface with one implementation per mode. Route all API handlers through `lib/runtime/index.ts` only. Never grow two parallel codepaths for new features.

---

### 1.2 Mock seeding helpers duplicated — MEDIUM

`headPayload`, agent seeding, and `agent_phase` from node status are copy-pasted in:
- `lib/mock/store.ts`
- `lib/mock/seed.ts`

**Action:** Move shared helpers to `lib/mock/helpers.ts`; import from both files.

---

### 1.3 Gateway / head API URL construction (3 places) — MEDIUM

Same env vars and URL shape repeated with **inconsistent default ports**:

| File | Default port |
|------|--------------|
| `lib/mock/store.ts` | `APPLIANCE_PORT ?? '3000'` |
| `lib/runtime/gateway.ts` | `APPLIANCE_CONSOLE_PORT ?? '80'` |
| `lib/runtime/inferedge.ts` | `APPLIANCE_CONSOLE_PORT ?? APPLIANCE_PORT ?? '80'` |

**Action:** Single `lib/runtime/urls.ts` with `resolveHeadApiBase()` and unified port precedence: `APPLIANCE_HEAD_INTERNAL_URL` → `HEAD_CONSOLE_URL` → `head_ip` + port.

---

### 1.4 Three HTTP client stacks — MEDIUM

| Client | File | Error type |
|--------|------|------------|
| Browser → Next API | `lib/api.ts` | `ApiError` |
| Next → controller | `lib/runtime/client.ts` | `ControllerError` |
| Next → support service | `lib/support/client.ts` | `SupportServiceError` |

`inferedge.ts` duplicates controller error-body parsing in `migrateHead` and `importConfig`. Three nearly identical 404 handlers in `updateNode`, `getDeployment`, `updateDeployment`.

**Action:** `parseControllerErrorBody(body)` and `handleControllerNotFound()` in `lib/runtime/client.ts`. Consider thin shared `fetchJson` where shapes align.

---

### 1.5 Console page load/error boilerplate — MEDIUM

Same pattern in 8+ pages: `useState(loading/error)`, `setLoading(true)`, `api.*().catch(e => e instanceof ApiError ? ...)`, `useEffect(load)`.

Examples: `nodes/page.tsx`, `deployments/page.tsx`, `config/page.tsx`, `orchestration/page.tsx`.

`PageState` exists (`components/PageState.tsx`) but only `config/page.tsx` uses it.

**Action:** `useResourceLoader()` hook or consistent `PageState` wrapper; centralize `formatApiError(e: unknown): string`.

---

### 1.6 Support page bypasses `lib/api.ts` — MEDIUM

`lib/api.ts` defines `supportEntitlement`, `supportPreview`, `supportSubmit`, `supportTicket`, `supportTickets`, but `app/(console)/support/page.tsx` uses raw `fetch` for preview, entitlement, submit, and polling — reimplementing `ApiError` parsing.

**Action:** Use `api.*` everywhere on the support page; add `pollSupportTicket(id)` if polling belongs in the client layer.

---

### 1.7 Orchestration switch logic duplicated in UI — MEDIUM

`app/(console)/orchestration/page.tsx` has two parallel `switch (pendingSwitch.kind)` blocks:
- Apply change
- Confirm dialog copy

Both map kinds → `describeOrchestrationSwitch` / `normalizeClusterPatch` with repeated `federation_layout ?? 'replicated'` and `head_gpu ?? true`.

**Action:** Extract `buildOrchestrationSwitchPatch(kind, to, cluster)` and `describePendingSwitch(cluster, pending, deploymentCount)` in `lib/orchestration-switch.ts`.

---

### 1.8 Model source → model ID extraction — LOW

- `lib/appliance-status.ts` — `deploymentModelRef`
- `lib/validation/vram.ts` — `modelIdFromDeployment`
- `lib/validation/feasibility.ts` — wraps as `deploymentModelId`

**Action:** Export one `modelRefFromSource(source: ModelSource): string | null` from `lib/deployment-vocabulary.ts`.

---

### 1.9 Type definitions duplicated with Zod schemas — LOW

`lib/types.ts` enums mirror `lib/schema.ts` `z.enum([...])`. Drift risk when adding values.

**Action:** `z.infer<typeof schema>` where possible, or generate Zod from `as const` objects.

---

### 1.10 Deprecated API aliases — LOW

Duplicate endpoints and client methods:
- `app/api/cluster/route.ts` → re-exports orchestration
- `app/api/cluster/migrate-head/route.ts` → re-exports orchestration migrate
- `lib/api.ts` — `getCluster` / `putCluster`
- `lib/runtime/inferedge.ts` — deprecated wrappers
- `lib/runtime/index.ts` — deprecated exports

**Action:** Remove after deprecation window, or gate behind a single compatibility module.

---

### 1.11 Support mock error mapping — LOW

`lib/support/client.ts` maps `MockSupportError` → `SupportServiceError` identically in `submitBundle`, `getTicket`, and `listTickets`.

**Action:** `function wrapMockSupport<T>(fn: () => Promise<T>): Promise<T>`.

---

## 2. Hardcoded values

### 2.1 Appliance / reconcile state strings — HIGH

Magic strings without a single source of truth:

| States | Locations |
|--------|-----------|
| `READY`, `RECONCILING`, `DEGRADED`, `BOOT`, `FAILED` | `lib/runtime/inferedge.ts`, `lib/mock/store.ts`, `lib/orchestration-switch.ts`, `lib/support/mock.ts` |
| Completion events | `lib/orchestration-switch.ts` (`reconcile_ready`, etc.) |

InferEdge controller defines `ApplianceState` enum; console does not import or mirror it.

**Action:** `lib/constants/appliance-state.ts` with `APPLIANCE_STATES`, `SETTLED_STATES`, `RECONCILE_COMPLETION_EVENTS` as const; align with controller enum values.

---

### 2.2 Legacy compute backend migration map — MEDIUM

`lib/schema.ts` `normalizeComputeBackend()`:

```typescript
if (value === 'litellm_vllm' || value === 'local' || value === 'worker_pool') return 'federation';
if (value === 'ray_cluster') return 'cluster';
```

**Action:** `LEGACY_COMPUTE_BACKEND_MAP: Record<string, ComputeBackend>` in a config/migration module.

---

### 2.3 V1 → V2 config migration defaults — MEDIUM

Hardcoded in `lib/schema.ts`:
- `context_length ?? 8192`
- `target_ongoing_requests ?? 8`
- `status ?? 'stopped'`
- v1 `serving_mode`: `ray_cluster` / `litellm_standalone`

**Action:** `CONFIG_MIGRATION_DEFAULTS` object; align with `DeploymentForm.tsx` defaults.

---

### 2.4 GPU / planner magic numbers — MEDIUM

| Value | Locations |
|-------|-----------|
| `0.85` GPU util | `lib/validation/feasibility.ts`, `lib/planner.ts`, `DeploymentForm.tsx` |
| `8192` context | `lib/planner.ts`, `DeploymentForm.tsx`, `lib/schema.ts` |
| `32B` model heuristic | `lib/planner.ts` |
| Scale multipliers `1/2/3` | `lib/planner.ts` |

**Action:** `lib/constants/deployment-defaults.ts` shared by planner, form, schema migration, and validation.

---

### 2.5 Timing / polling constants — LOW

- `lib/orchestration-switch.ts` — `300_000` ms settle timeout, `1_000` ms interval
- `app/(console)/support/page.tsx` — 40 attempts × 500 ms
- `app/(console)/page.tsx` — 5 s poll
- `lib/mock/store.ts` — `5000` / `15000` agent intervals

**Action:** Named constants; env-overridable where appropriate for E2E tuning.

---

### 2.6 Support diagnosis keyword matching — LOW

`lib/support/mock.ts` — `'out of memory'`, `'oom'` string checks. Duplicates `appliance-support/src/ai/stub.py` and `inferedge-phase1/controller/serving/load_errors.py` markers.

**Action:** Import markers from shared support contract spec, not inline strings.

---

### 2.7 UI label duplication for serving mode — LOW

- `lib/orchestration-switch.ts` — `labelServingMode`
- `app/(console)/page.tsx` — inline `'Distributed' : 'Standalone'`
- `app/(console)/orchestration/page.tsx` — same inline ternary

**Action:** Use `labelServingMode()` everywhere.

---

## 3. Poor design choices

### 3.1 God files / mixed concerns — HIGH

| File | Lines | Concerns mixed |
|------|-------|----------------|
| `lib/mock/store.ts` | ~639 | Persistence, orchestration, deployments, agents, WS broadcast, gateway, reconcile simulation |
| `components/DeploymentForm.tsx` | ~695 | Form state, placement UI, validation UX, recommend API, cluster mode logic |
| `app/(console)/orchestration/page.tsx` | ~543 | Data loading, switch flows, head migration, detach, autoscaling, confirm dialogs |
| `lib/validation/feasibility.ts` | ~355 | VRAM, placement, autoscale, cross-deployment GPU budget |

**Action:** Split mock store into `persistence`, `orchestration-ops`, `deployment-ops`, `agent-sim`. Split `DeploymentForm` into field groups + `useDeploymentForm` hook. Extract orchestration page dialogs into components.

---

### 3.2 `runWithHeadAuthority` is a no-op — MEDIUM

```typescript
/** Console always talks to the local controller — no head console proxy. */
export async function runWithHeadAuthority(_req, handler) {
  return handler();
}
```

Used in ~15 API routes. `lib/mock/gateway.ts` only re-exports `lib/runtime/gateway.ts`.

**Action:** Remove wrapper from routes or restore real coordinator-proxy behavior. Dead abstraction adds noise.

---

### 3.3 Divergent orchestration update paths — MEDIUM

- `putOrchestration` (inferedge): full PUT
- `updateOrchestration` (inferedge): special-cases `head_node_id` → `migrateHead` before merge
- Mock: `putOrchestration` calls full cluster update; `updateOrchestration` accepts partial

API `PUT /api/orchestration` uses `putOrchestration` only. Head migration via cluster PUT is only in deprecated `updateOrchestration`.

**Action:** Document and unify semantics; one orchestration write API with explicit head migration endpoint.

---

### 3.4 API routes lack consistent error handling — MEDIUM

Many routes return unhandled 500s: `app/api/orchestration/route.ts`, `app/api/deployments/route.ts`, `app/api/nodes/[id]/route.ts` (partial).

Contrast with `app/api/config/route.ts` and support routes.

**Action:** `lib/api-route.ts` with `withApiHandler(handler)` mapping `ControllerError`, Zod errors, and generic `Error` to `NextResponse.json`.

---

### 3.5 `buildConsoleContext` is a trivial passthrough — LOW

```typescript
export function buildConsoleContext(gateway, cluster) {
  return { gateway, cluster };
}
```

**Action:** Inline or enrich context (precomputed capabilities) to justify the helper.

---

### 3.6 `proxyWsStream` export misleading — LOW

`lib/runtime/index.ts` exports `proxyWsStream` → inferedge only; mock path handled separately in `app/api/v1/ws/route.ts`.

**Action:** Unified `getWsStream()` in runtime index.

---

### 3.7 Planner heuristics embedded in production path — LOW

`lib/planner.ts` uses string checks (`includes('32B')`), fixed scale tables, and hard thresholds (`gpus >= 8`) without configuration.

**Action:** Externalize heuristics or document as demo-tier logic; tie to model registry long term.

---

## 4. Cross-layer duplication (`lib/` ↔ `app/`)

### 4.1 Fetch path duplication — MEDIUM

```
app/(console)/*.tsx  →  lib/api.ts  →  app/api/*/route.ts  →  lib/runtime  →  mock | inferedge
support/page.tsx     →  fetch (bypass)  →  app/api/support/*  →  lib/support/client
```

**Action:** Enforce single browser entry (`lib/api.ts`); server routes stay thin delegates.

---

### 4.2 Orchestration settle polling duplicated — MEDIUM

`waitForOrchestrationSettle` lives in `lib/orchestration-switch.ts`, but `orchestration/page.tsx` repeats the poll lambda twice.

**Action:** `pollApplianceStatus(): Promise<OrchestrationPollSnapshot>` in `lib/api.ts` or `lib/orchestration-switch.ts`.

---

### 4.3 Status / degraded UI logic split — LOW

Logic in `lib/appliance-status.ts`; display duplicated in `app/(console)/page.tsx` for exit_code / log_snippet rendering.

**Action:** `RuntimeWarningBanner` component consuming `ApplianceStatus`.

---

### 4.4 Validation UX gap — LOW

`deployments/page.tsx` calls `api.validate` but `handleSave` returns silently if invalid.

**Action:** Surface validation errors in UI.

---

### 4.5 `schemas/` JSON vs `lib/schema.ts` — LOW

`schemas/conf.v1.json` and `conf.v2.json` exist alongside programmatic Zod in `lib/schema.ts`. No import of JSON schemas in production TS.

**Action:** Generate JSON Schema from Zod or load JSON Schema for validation — one source.

---

## 5. Cross-repo coordination

| Pattern | This repo | Other repos |
|---------|-----------|-------------|
| Stub diagnosis | `lib/support/mock.ts` | `appliance-support/src/ai/stub.py`, `scripts/ai_diagnose_stub.py` |
| Secret redaction | `lib/support/redact.ts` (2 regexes) | `appliance-support/src/redact.py` (5 regexes) |
| Log tail limits | `redact.ts` truncateLogTail (200 / 64 KB) | `inferedge-phase1/controller/support_diagnostics.py` |
| Bundle / ticket types | `lib/support/types.ts` | `appliance-support/src/schemas.py`, `schemas/*.json` |
| Support client version | `lib/support/bundle.ts` `"1.0.0"` | `appliance-support/src/schemas.py` |

**Action:** Generate TypeScript from `appliance-support/schemas/`; shared `support-redaction.yaml` for keys and regex patterns with contract tests across repos.

---

## 6. Prioritized roadmap

| Priority | Item | Effort |
|----------|------|--------|
| **P0** | `lib/constants/appliance-state.ts` + `deployment-defaults.ts` | Small |
| **P0** | `RuntimeBackend` interface — stop parallel mock/inferedge growth | Large |
| **P1** | `lib/runtime/urls.ts` — unify head URL/port (fixes bug class) | Small |
| **P1** | `useAsyncResource` hook + `PageState` adoption | Medium |
| **P1** | Support page → `lib/api.ts`; shared error parsing | Small |
| **P1** | Shared redaction spec with appliance-support | Small |
| **P2** | Split `mock/store.ts`; orchestration switch helpers | Medium |
| **P2** | `withApiHandler` for API route errors | Small |
| **P2** | Consolidate stub heuristics via shared contract | Medium |
| **P3** | Remove deprecated cluster API aliases | Small |
| **P3** | Derive types from Zod; JSON schema single source | Medium |

### Suggested implementation order

1. Constants module — states, defaults, legacy backend map (low risk, high clarity)
2. `lib/runtime/urls.ts` + error parsing — fix port inconsistency
3. `useAsyncResource` / `PageState` — reduce app boilerplate
4. Support page → `lib/api.ts` — quick cross-layer win
5. `RuntimeBackend` interface — structural fix before more drift
6. Split god files — incremental extractions

This ordering improves consistency and reduces duplicate-bug risk without a big-bang rewrite.