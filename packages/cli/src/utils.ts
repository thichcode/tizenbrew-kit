import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'fs-extra';
import { loadConfigFromFile } from 'vite';
import { createManifest, validateConfig, type TizenBrewModuleConfig } from '@kv8n2oryk/tizenbrew-kit-core';

const CONFIG_CANDIDATES = ['tizenbrew.config.ts', 'tizenbrew.config.mts', 'tizenbrew.config.js'];

export async function resolveConfigPath(cwd = process.cwd()): Promise<string> {
  for (const file of CONFIG_CANDIDATES) {
    const fullPath = path.join(cwd, file);
    if (await fs.pathExists(fullPath)) {
      return fullPath;
    }
  }
  throw new Error('Cannot find tizenbrew config file. Expected one of: tizenbrew.config.ts|mts|js');
}

export async function loadConfig(cwd = process.cwd()): Promise<TizenBrewModuleConfig> {
  const configPath = await resolveConfigPath(cwd);
  let config: TizenBrewModuleConfig | undefined;

  if (configPath.endsWith('.ts') || configPath.endsWith('.mts')) {
    const loaded = await loadConfigFromFile(
      {
        command: 'build',
        mode: 'production',
      },
      configPath,
      cwd,
      undefined,
      false,
    );
    config = loaded?.config as TizenBrewModuleConfig | undefined;
  } else {
    const mod = await import(pathToFileURL(configPath).href);
    config = mod.default as TizenBrewModuleConfig | undefined;
  }

  if (!config) {
    throw new Error(`Config file at ${configPath} must export default defineTizenBrewModule({...}).`);
  }

  validateConfig(config);
  return config;
}

export async function ensureProjectSources(cwd = process.cwd()): Promise<void> {
  const srcDir = path.join(cwd, 'src');
  await fs.ensureDir(srcDir);

  const injectPath = path.join(srcDir, 'inject.ts');
  const stylePath = path.join(srcDir, 'style.css');

  if (!(await fs.pathExists(injectPath))) {
    await fs.writeFile(
      injectPath,
      `export function bootstrapModule() {\n  console.info('[TizenBrewKit] inject loaded');\n}\n\nbootstrapModule();\n`,
      'utf8',
    );
  }

  if (!(await fs.pathExists(stylePath))) {
    await fs.writeFile(stylePath, `/* module styles */\n:root {\n  color-scheme: dark;\n}\n`, 'utf8');
  }
}

export async function writeManifestAndModule(cwd = process.cwd()): Promise<void> {
  const config = await loadConfig(cwd);
  const distDir = path.join(cwd, 'dist');
  await fs.ensureDir(distDir);

  const manifest = createManifest(config);
  // Fix asset paths to match dist output filenames
  manifest.assets.scripts = manifest.assets.scripts.map((s) => path.basename(s).replace(/\.ts$/, '.js'));
  manifest.assets.styles = manifest.assets.styles.map((s) => path.basename(s));
  const moduleJson = {
    id: config.name,
    name: config.displayName,
    version: config.version,
    entry: 'manifest.json',
    targetUrl: config.targetUrl,
  };

  await fs.writeJson(path.join(distDir, 'manifest.json'), manifest, { spaces: 2 });
  await fs.writeJson(path.join(distDir, 'module.json'), moduleJson, { spaces: 2 });

  await fs.writeFile(
    path.join(distDir, 'README.md'),
    `# ${config.displayName}\n\nVersion: ${config.version}\n\n## Usage in TizenBrew\n1. Copy dist files into your TizenBrew module folder.\n2. Load module.json / manifest.json depending on your TizenBrew workflow.\n3. Ensure assets are accessible and target URL matches expected page.\n`,
    'utf8',
  );
}