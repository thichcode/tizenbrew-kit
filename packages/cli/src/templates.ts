import path from 'node:path';
import fs from 'fs-extra';
import type { TemplateName } from './types';

const TEMPLATE_ROOT = path.resolve(process.cwd(), 'packages', 'templates');

export function getTemplatePath(template: TemplateName): string {
  return path.join(TEMPLATE_ROOT, template);
}

export async function copyTemplate(template: TemplateName, targetDir: string): Promise<void> {
  const sourceDir = getTemplatePath(template);
  if (!(await fs.pathExists(sourceDir))) {
    throw new Error(`Template not found: ${template}`);
  }

  await fs.ensureDir(targetDir);
  await fs.copy(sourceDir, targetDir, { overwrite: false, errorOnExist: false });
}
