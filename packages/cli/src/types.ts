import type { TizenBrewModuleConfig } from '@tizenbrew-kit/core';

export type TemplateName = 'blank' | 'youtube-tv-lite' | 'facebook-reels-lite' | 'noc-dashboard';

export interface LoadedConfig {
  configPath: string;
  config: TizenBrewModuleConfig;
}
