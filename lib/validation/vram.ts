/** Mirrors inferedge-phase1/controller/gpu.py VRAM / KV-cache budgeting. */

const CONTEXT_STEPS = [8192, 4096, 3072, 2048, 1536, 1024, 512] as const;

const QUANT_TAGS = ['awq', 'gptq', 'fp8', 'marlin', 'quant', 'gguf', 'bnb', 'int4', 'int8'];

export function isQuantizedModelId(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return QUANT_TAGS.some((tag) => lower.includes(tag));
}

export function paramBillions(modelId: string): number | null {
  const match = modelId.match(/(\d+(?:\.\d+)?)\s*[bB]/);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}

export function estimateWeightGb(modelId: string): number | null {
  const paramB = paramBillions(modelId);
  if (paramB === null) return null;
  const lower = modelId.toLowerCase();
  const multiplier = lower.includes('gptq') ? 0.5 : isQuantizedModelId(modelId) ? 0.67 : 2.0;
  return paramB * multiplier;
}

export function estimateWeightMb(modelId: string): number | null {
  const gb = estimateWeightGb(modelId);
  return gb === null ? null : Math.round(gb * 1024);
}

/** Fallback when model id has no param size (e.g. custom org names). */
export function estimateWeightMbHeuristic(modelId: string): number {
  const lower = modelId.toLowerCase();
  if (lower.includes('70b')) return 140_000;
  if (lower.includes('32b')) return 64_000;
  if (lower.includes('13b')) return 26_000;
  if (lower.includes('8b') || lower.includes('7b')) {
    return Math.round((estimateWeightGb(modelId) ?? (isQuantizedModelId(modelId) ? 5.36 : 16)) * 1024);
  }
  return 24_000;
}

export function kvCacheGb(modelId: string, contextLength: number): number {
  const paramB = paramBillions(modelId) ?? 8.0;
  return paramB * 0.00005 * contextLength;
}

function activationOverheadGb(modelId: string): number {
  return isQuantizedModelId(modelId) ? 1.2 : 2.0;
}

export function vramFitsOnDevices(
  modelId: string,
  contextLength: number,
  gpuUtilization: number,
  totalVramMb: number,
): boolean {
  const weightGb = estimateWeightGb(modelId);
  if (weightGb === null) return true;
  const totalGb = totalVramMb / 1024;
  const kvBudgetGb =
    totalGb * gpuUtilization - weightGb - activationOverheadGb(modelId);
  return kvBudgetGb >= kvCacheGb(modelId, contextLength) * 1.05;
}

export function capContextLength(
  modelId: string,
  requested: number,
  gpuUtilization: number,
  totalVramMb: number,
): number {
  const candidates = CONTEXT_STEPS.filter((step) => step <= requested);
  for (const contextLength of [...candidates].sort((a, b) => b - a)) {
    if (vramFitsOnDevices(modelId, contextLength, gpuUtilization, totalVramMb)) {
      return contextLength;
    }
  }
  return 512;
}

/** totalVramMb is the combined VRAM budget for the instance (sum of selected GPUs). */
export function weightsExceedGpuVram(
  modelId: string,
  totalVramMb: number,
  _gpusPerInstance = 1,
): boolean {
  const weightGb = estimateWeightGb(modelId);
  if (weightGb === null || totalVramMb <= 0) return false;
  const budgetGb = totalVramMb / 1024;
  return weightGb > budgetGb;
}

export function checkVramForModel(
  modelId: string,
  contextLength: number,
  gpuUtilization: number,
  totalVramMb: number,
  gpuName: string,
  gpusPerInstance = 1,
): string | null {
  const weightGb = estimateWeightGb(modelId);
  if (weightGb === null || totalVramMb <= 0) return null;

  const totalGb = totalVramMb / 1024;
  const quantLabel = isQuantizedModelId(modelId) ? ' (quantized)' : '';

  if (weightsExceedGpuVram(modelId, totalVramMb, gpusPerInstance)) {
    const quantHint = isQuantizedModelId(modelId)
      ? ' Try a smaller model or more GPUs per instance.'
      : ' Use a quantized variant (AWQ/GPTQ), a smaller model, or more GPUs per instance.';
    return (
      `Estimated model weights (~${weightGb.toFixed(1)} GB${quantLabel}) exceed ${gpuName} ` +
      `(${Math.round(totalGb)} GB).${quantHint}`
    );
  }

  if (vramFitsOnDevices(modelId, contextLength, gpuUtilization, totalVramMb)) {
    return null;
  }

  const kvNeededGb = kvCacheGb(modelId, contextLength);
  const kvBudgetGb =
    totalGb * gpuUtilization - weightGb - activationOverheadGb(modelId);
  const capped = capContextLength(modelId, contextLength, gpuUtilization, totalVramMb);
  const contextHint =
    capped < contextLength ? ` Try context_length=${capped} or lower on this GPU.` : '';
  return (
    `GPU VRAM likely insufficient for ${modelId} at context ${contextLength}: ` +
    `~${kvNeededGb.toFixed(1)} GB KV cache needed, ~${Math.max(kvBudgetGb, 0).toFixed(1)} GB KV budget ` +
    `on ${gpuName}.${contextHint} Try gpu_utilization>=0.95 or lower context_length.`
  );
}

export function modelIdFromDeployment(source: {
  type: string;
  repo_id?: string;
  path?: string;
}): string | null {
  if (source.type === 'huggingface') {
    return source.repo_id?.trim() || null;
  }
  if (source.type === 'local_path') {
    return source.path?.trim() || null;
  }
  return null;
}