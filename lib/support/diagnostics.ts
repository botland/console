import type { SupportDiagnostics } from '@/lib/support/types';

export function mockSupportDiagnostics(applianceId: string): SupportDiagnostics {
  return {
    version: 'mock',
    appliance_id: applianceId,
    container_logs_tail: {
      runtime: 'mock runtime log line',
    },
    reconcile_log_tail: [],
    host: {
      disk: { total_bytes: 1_000_000_000_000, used_bytes: 400_000_000_000, free_bytes: 600_000_000_000 },
      gpu: {
        available: true,
        device_count: 2,
        devices: [
          { index: 0, name: 'Mock GPU', total_vram_mb: 24_000, free_vram_mb: 18_000 },
          { index: 1, name: 'Mock GPU', total_vram_mb: 24_000, free_vram_mb: 20_000 },
        ],
      },
      nvidia_driver_version: '550.00',
    },
  };
}