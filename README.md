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
| `POST /api/cluster/migrate-head` | Head migration |
| `GET /api/v1/ws` | SSE: `cluster.state`, `node.metrics`, `head.changed`, `events` |
| `GET /api/config/export` | `conf.json` download |

## Future integration

1. `appliance-agent` on each node (telemetry + heartbeat to head)
2. Worker gateways proxy `/api/v1` to head
3. Private runtime adapter to `inferedge-phase1` (no tech names in public API)