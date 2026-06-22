# OwnEdge Appliance Console

Standalone web UI for managing OwnEdge AI appliances. Matches the look and feel of [b2b.ownedge.ai](https://b2b.ownedge.ai/en) (from [botland/nocloud](https://github.com/botland/nocloud)).

**This is a functional mock** — it uses a built-in mock API and a demo 3-node cluster. No changes to `inferedge-phase1` are required.

## Quick start

```bash
cd appliance-console
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tabs

| Tab | Purpose |
|-----|---------|
| Overview | Appliance health, GPU utilization, events |
| Deployments | Add/edit models (HF or local path), guided + advanced settings |
| Cluster | Ray Serve LLM vs LiteLLM + vLLM mode |
| Nodes | 3-node demo cluster (head + workers) |
| Storage | Disk usage, directory browser, NFS/SMB mounts |
| System | Network, NTP, security |
| Config | Export/import `conf.json` |

## Serving modes

- **Ray Serve LLM cluster** — distributed inference, cross-node TP/PP
- **LiteLLM + vLLM** — head runs LiteLLM proxy, workers run vLLM (TP limited to single node)

## `conf.json` and USB dongle

The console exports `conf.json` with jq-sorted keys, compatible with the USB workflow:

1. USB mounted at `/mnt/dongles/<device>/` (see `usb-dongle-mount.sh`)
2. Place `conf.json` on the dongle
3. `usb-dongle-check.sh` copies it to `/home/conf.json` when changed

Future integration: an agent reads `/home/conf.json` and applies it to the real controller.

## Mock API

State persists to `.data/state.json` between restarts.

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Appliance state + config |
| `GET/PUT /api/config` | Full configuration |
| `GET /api/config/export` | Download `conf.json` |
| `POST /api/import` | Import configuration |
| `GET/POST/PUT/DELETE /api/deployments` | Deployment CRUD |
| `POST /api/deployments/recommend` | Planner recommendations |
| `GET/PUT /api/cluster` | Cluster settings |
| `GET/PUT /api/nodes/:id` | Per-node settings |
| `GET/PUT /api/system` | System settings |
| `GET /api/storage` | Storage browser + mounts |
| `GET /api/events` | SSE status stream |

## Future integration

1. Extract to `github.com/botland/appliance-console`
2. Replace `lib/mock/` with client calls to `inferedge-phase1` controller `/api/v1`
3. Share UI tokens with `nocloud` via package or submodule
4. Wire `conf.json` ↔ USB dongle ↔ controller reconciler

## Environment

```bash
NEXT_PUBLIC_MOCK_APPLIANCE_ID=forge-demo-001
NEXT_PUBLIC_BRAND_NAME=OwnEdge
```