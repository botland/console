# OwnEdge Appliance Console

Standalone web UI for managing OwnEdge AI appliances. Matches the look and feel of [b2b.ownedge.ai](https://b2b.ownedge.ai/en) (from [botland/nocloud](https://github.com/botland/nocloud)).

**Functional mock** with built-in API, demo 3-node cluster, hardware validation, and head migration simulation.

## Quick start

```bash
cd appliance-console
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Version stamp (support bundles)

Production images set `APPLIANCE_CONSOLE_VERSION` to a **git SHA or tag** (via Docker build-arg
`APP_VERSION`, filled by the appliance stack’s `resolve-versions.sh`). Support diagnostic bundles
use that value as `software.console_version` — do not rely on npm package version.

When building via the InferEdge stack: set `APPLIANCE_PROD=false` (any branch) or `true` (must be
on branch `prod`) in the stack `.env`.

## Design principles

- **No technology leakage** — UI never mentions Ray, vLLM, or LiteLLM
- **Head = control plane** — user-designated head runs aggregation; workers proxy to it
- **Hardware validation** — deployments checked against cluster GPU inventory before save

## Serving topologies

| Mode | User label | Behavior |
|------|------------|----------|
| `distributed` | Distributed | Multi-node; instances can span nodes |
| `standalone` | Standalone | Parallelism limited to a single node |

## Head migration

Changing the head (Cluster or Nodes tab) triggers:

1. `head_epoch` increment
2. `head.changed` event on `/api/v1/ws`
3. Simulated worker repoint + deployment reschedule

Export `conf.json` includes `head_node_id`, `head_ip`, and `head_epoch` for USB dongle compatibility.

## Config schema

- **v2** (current): `distributed`/`standalone`, `parallelism.instances`, `gpus_per_instance`, `nodes_per_instance`
- **v1** import: auto-migrated from legacy `ray_cluster`/`litellm_standalone` names

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | State + config |
| `POST /api/deployments/validate` | Hardware feasibility check |
| `GET/PUT /api/orchestration` | Topology and backend settings |
| `POST /api/orchestration/migrate-head` | Head migration |
| `GET/PUT /api/cluster` | Deprecated alias of orchestration |
| `GET /api/v1/ws` | SSE: `cluster.state`, `node.metrics`, `head.changed`, `events` |
| `GET /api/config/export` | `conf.json` download |

## Multi-node mock (Phase 2)

Simulated agents on every node push GPU telemetry to the head coordinator every 5s. Worker gateways proxy API calls to the head unless they are the coordinator.

```bash
# Run as worker node (proxies to coordinator console via HEAD_CONSOLE_URL)
APPLIANCE_LOCAL_NODE_ID=node-1 HEAD_CONSOLE_URL=http://10.0.0.2/api npm run dev

# Optional overrides
APPLIANCE_HEAD_INTERNAL_URL=http://127.0.0.1:3000   # proxy target (dev)
APPLIANCE_GATEWAY_INTERNAL=1                        # same-process delegate (tests)
APPLIANCE_DISABLE_AGENT_SIM=1                       # disable heartbeat loop
```

`GET /api/status` includes `gateway: { local_node_id, is_head, head_api_url }`.

## Backend integration

### Unified Docker stack (recommended)

```bash
cd inferedge-phase1
cp .env.example .env
./scripts/compose.sh up -d --build
```

Open [http://localhost/](http://localhost/) (Traefik → console). Management API: [http://localhost/api/status](http://localhost/api/status).

### Local dev (console + controller separately)

By default `npm run dev` uses **mock mode**. To point at a running controller:

```bash
# Terminal 1
cd inferedge-phase1 && ./scripts/compose.sh up -d controller traefik litellm

# Terminal 2
cd appliance-console
APPLIANCE_RUNTIME=inferedge \
APPLIANCE_CONTROLLER_URL=http://127.0.0.1:8080 \
APPLIANCE_CONTROLLER_TOKEN=change-me-in-production \
npm run dev
```

| Env | Default | Description |
|-----|---------|-------------|
| `APPLIANCE_RUNTIME` | `mock` | `mock` or `inferedge` |
| `APPLIANCE_CONTROLLER_URL` | `http://127.0.0.1:8080` | inferedge controller base URL |
| `APPLIANCE_CONTROLLER_TOKEN` | — | Bearer token for protected controller endpoints |

With `APPLIANCE_RUNTIME=inferedge` (default in Docker), all console `/api/*` routes are wired to the controller.

For integration status and E2E testing, see the [root README](../README.md#unified-appliance-phase-35).