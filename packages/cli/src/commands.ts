import path from 'node:path';
import { createServer, build as viteBuild } from 'vite';
import fs from 'fs-extra';
import archiver, { type ArchiverError } from 'archiver';
import { copyTemplate } from './templates';
import { ensureProjectSources, loadConfig, writeManifestAndModule } from './utils';
import type { TemplateName } from './types';

const SUPPORTED_TEMPLATES: TemplateName[] = [
  'blank',
  'youtube-tv-lite',
  'facebook-reels-lite',
  'noc-dashboard',
  'iptv-player',
];

function pickTemplate(input?: string): TemplateName {
  if (!input) return 'blank';
  if (SUPPORTED_TEMPLATES.includes(input as TemplateName)) return input as TemplateName;
  throw new Error(`Unknown template: ${input}. Valid: ${SUPPORTED_TEMPLATES.join(', ')}`);
}

export async function createCommand(name: string, templateInput?: string): Promise<void> {
  const template = pickTemplate(templateInput);
  const targetDir = path.resolve(process.cwd(), name);

  if (await fs.pathExists(targetDir)) {
    throw new Error(`Directory already exists: ${targetDir}`);
  }

  await copyTemplate(template, targetDir);
  await ensureProjectSources(targetDir);
  console.info(`Created ${name} from template ${template}`);
}

export async function devCommand(): Promise<void> {
  await ensureProjectSources();
  const config = await loadConfig();

  const server = await createServer({
    root: process.cwd(),
    server: { host: '0.0.0.0', port: 5173 },
  });

  await server.listen();
  const url = `http://localhost:5173`;

  console.info(`[tizenbrew-kit] Dev server running: ${url}`);
  console.info(`[tizenbrew-kit] Target URL: ${config.targetUrl}`);
  console.info('[tizenbrew-kit] Load your module in TizenBrew and map inject bundle from local dev output.');
}

export async function buildCommand(): Promise<void> {
  const config = await loadConfig();
  const distDir = path.join(process.cwd(), 'dist');

  await fs.emptyDir(distDir);

  for (const entry of config.inject.scripts) {
    await viteBuild({
      configFile: false,
      build: {
        outDir: distDir,
        emptyOutDir: false,
        sourcemap: true,
        lib: {
          entry: path.resolve(process.cwd(), entry),
          formats: ['es'],
          fileName: () => path.basename(entry).replace(/\.ts$/, '.js'),
        },
      },
    });
  }

  for (const style of config.inject.styles) {
    const stylePath = path.resolve(process.cwd(), style);
    const targetPath = path.join(distDir, path.basename(style));
    await fs.copy(stylePath, targetPath);
  }

  await writeManifestAndModule(process.cwd());
  console.info(`[tizenbrew-kit] Build completed for ${config.name}`);
}

export async function packageCommand(): Promise<void> {
  const config = await loadConfig();
  const distDir = path.join(process.cwd(), 'dist');
  if (!(await fs.pathExists(distDir))) {
    throw new Error('dist/ not found. Run `tizenbrew-kit build` first.');
  }

  const releaseDir = path.join(process.cwd(), 'release');
  await fs.ensureDir(releaseDir);
  const zipPath = path.join(releaseDir, `${config.name}-${config.version}.zip`);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err: ArchiverError) => reject(err));

    archive.pipe(output);
    archive.directory(distDir, false);
    archive.finalize().catch(reject);
  });

  console.info(`[tizenbrew-kit] Package created: ${zipPath}`);
}

export async function doctorCommand(): Promise<void> {
  const issues: string[] = [];
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);

  if (nodeMajor < 20) {
    issues.push(`Node.js >= 20 is required. Current: ${process.versions.node}`);
  }

  const configPath = path.join(process.cwd(), 'tizenbrew.config.ts');
  if (!(await fs.pathExists(configPath))) {
    issues.push('Missing tizenbrew.config.ts in current directory.');
  } else {
    try {
      const config = await loadConfig();
      for (const script of config.inject.scripts) {
        const exists = await fs.pathExists(path.resolve(process.cwd(), script));
        if (!exists) issues.push(`Missing script file: ${script}`);
      }
      for (const style of config.inject.styles) {
        const exists = await fs.pathExists(path.resolve(process.cwd(), style));
        if (!exists) issues.push(`Missing style file: ${style}`);
      }
    } catch (error) {
      issues.push((error as Error).message);
    }
  }

  if (issues.length > 0) {
    console.error('[tizenbrew-kit doctor] Found issues:');
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }

  console.info('[tizenbrew-kit doctor] All checks passed.');
}
