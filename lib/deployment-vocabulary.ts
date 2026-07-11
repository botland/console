/** Short glossary aligned with Ray Serve / vLLM terminology. */

export const DEPLOYMENT_VOCAB = {
  displayName:
    'API model ID exposed to clients (LiteLLM model_name). Can differ from the Hugging Face repo.',
  instances:
    'Replica count — independent copies of the same model for throughput or availability.',
  instancesAuto:
    'At reconcile time, replicas are sized to fill available GPU slots (one slot = TP × PP GPUs).',
  gpusPerInstance:
    'Tensor parallel (TP) width: GPUs cooperating on one pipeline stage of the model shard.',
  nodesPerInstance:
    'Pipeline parallel (PP) depth: number of nodes spanned per replica (layers split across nodes).',
  gpuUtilization:
    'vLLM gpu_memory_utilization budget per process. Values on the same GPU must sum to ≤ 1.0.',
  contextLength: 'Maximum sequence length (tokens) passed to vLLM max_model_len.',
  autoscaling:
    'Ray Serve replica bounds. The controller maps instances to min/max replicas on the cluster.',
  scalePreset:
    'Guided replica sizing. Auto matches cluster GPU slots; Small/Medium/Large pick fixed counts.',
  placementAuto:
    'Cluster planner assigns nodes and GPUs using the orchestration layout (Replicated or Diverse).',
  placementManual:
    'You choose the node and GPU for each replica. Multiple models can share a GPU when combined utilization stays at or below 1.0.',
} as const;