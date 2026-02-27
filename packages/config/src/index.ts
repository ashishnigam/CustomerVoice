export interface ResidencyConfig {
  defaultZone: string;
  enabledZones: string[];
}

export function getResidencyConfig(): ResidencyConfig {
  const enabledZones = (process.env.DATA_RESIDENCY_ENABLED_ZONES ?? 'US')
    .split(',')
    .map((zone: string) => zone.trim())
    .filter(Boolean);

  return {
    defaultZone: process.env.DATA_RESIDENCY_DEFAULT_ZONE ?? 'US',
    enabledZones,
  };
}
