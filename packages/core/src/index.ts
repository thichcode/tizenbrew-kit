import { URL } from 'node:url';
import { ModuleManifest, TizenBrewModuleConfig } from './types';

const DEFAULTS: Pick<TizenBrewModuleConfig, 'description' | 'tvKeys' | 'performance'> = {
  description: '',
  tvKeys: { arrows: true, enter: true, back: true, playPause: false },
  performance: {
    removeAnimations: false,
    lazyMedia: false,
    hideComments: false,
    memorySaver: false,
  },
};

export function defineTizenBrewModule(config: TizenBrewModuleConfig): TizenBrewModuleConfig {
  return normalizeConfig(config);
}

export function normalizeConfig(config: TizenBrewModuleConfig): TizenBrewModuleConfig {
  return {
    ...config,
    description: config.description ?? DEFAULTS.description,
    tvKeys: {
      ...DEFAULTS.tvKeys,
      ...(config.tvKeys ?? {}),
    },
    performance: {
      ...DEFAULTS.performance,
      ...(config.performance ?? {}),
    },
    inject: {
      scripts: config.inject?.scripts ?? [],
      styles: config.inject?.styles ?? [],
    },
  };
}

export function validateConfig(config: TizenBrewModuleConfig): void {
  const normalized = normalizeConfig(config);
  const requiredStringFields: Array<keyof TizenBrewModuleConfig> = [
    'name',
    'displayName',
    'version',
    'targetUrl',
  ];

  for (const field of requiredStringFields) {
    const value = normalized[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Invalid config: "${field}" must be a non-empty string.`);
    }
  }

  if (!/^[a-z0-9-]+$/.test(normalized.name)) {
    throw new Error('Invalid config: "name" must contain only lowercase letters, numbers, and hyphens.');
  }

  if (!/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i.test(normalized.version)) {
    throw new Error('Invalid config: "version" must follow semantic versioning (e.g. 1.0.0).');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized.targetUrl);
  } catch {
    throw new Error('Invalid config: "targetUrl" must be a valid URL.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Invalid config: "targetUrl" protocol must be http or https.');
  }

  if (!Array.isArray(normalized.inject.scripts) || !Array.isArray(normalized.inject.styles)) {
    throw new Error('Invalid config: "inject.scripts" and "inject.styles" must be arrays.');
  }

  if (normalized.inject.scripts.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error('Invalid config: all "inject.scripts" entries must be non-empty strings.');
  }

  if (normalized.inject.styles.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error('Invalid config: all "inject.styles" entries must be non-empty strings.');
  }
}

export function createManifest(config: TizenBrewModuleConfig): ModuleManifest {
  validateConfig(config);
  const normalized = normalizeConfig(config);

  return {
    schemaVersion: 1,
    name: normalized.name,
    displayName: normalized.displayName,
    version: normalized.version,
    description: normalized.description ?? '',
    targetUrl: normalized.targetUrl,
    assets: {
      scripts: normalized.inject.scripts,
      styles: normalized.inject.styles,
    },
    capabilities: {
      tvKeys: {
        arrows: normalized.tvKeys?.arrows ?? true,
        enter: normalized.tvKeys?.enter ?? true,
        back: normalized.tvKeys?.back ?? true,
        playPause: normalized.tvKeys?.playPause ?? false,
      },
      performance: {
        removeAnimations: normalized.performance?.removeAnimations ?? false,
        lazyMedia: normalized.performance?.lazyMedia ?? false,
        hideComments: normalized.performance?.hideComments ?? false,
        memorySaver: normalized.performance?.memorySaver ?? false,
      },
    },
  };
}

export function createInjectionScript(config: TizenBrewModuleConfig): string {
  validateConfig(config);
  const normalized = normalizeConfig(config);
  return `(() => {
  const moduleMeta = ${JSON.stringify(
    {
      name: normalized.name,
      version: normalized.version,
      displayName: normalized.displayName,
    },
    null,
    2,
  )};
  console.info("[TizenBrewKit] Injection bootstrap", moduleMeta);
})();`;
}

export type { ModuleManifest, TizenBrewModuleConfig } from './types';
