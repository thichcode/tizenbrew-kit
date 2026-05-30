export interface InjectionConfig {
  scripts: string[];
  styles: string[];
}

export interface TvKeysConfig {
  arrows?: boolean;
  enter?: boolean;
  back?: boolean;
  playPause?: boolean;
}

export interface PerformanceConfig {
  removeAnimations?: boolean;
  lazyMedia?: boolean;
  hideComments?: boolean;
  memorySaver?: boolean;
}

export interface TizenBrewModuleConfig {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  targetUrl: string;
  inject: InjectionConfig;
  tvKeys?: TvKeysConfig;
  performance?: PerformanceConfig;
}

export interface ModuleManifest {
  schemaVersion: 1;
  name: string;
  displayName: string;
  version: string;
  description: string;
  targetUrl: string;
  assets: {
    scripts: string[];
    styles: string[];
  };
  capabilities: {
    tvKeys: Required<TvKeysConfig>;
    performance: Required<PerformanceConfig>;
  };
}
