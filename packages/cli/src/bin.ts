#!/usr/bin/env node
import { Command } from 'commander';
import {
  buildCommand,
  createCommand,
  devCommand,
  doctorCommand,
  packageCommand,
} from './commands';

const program = new Command();

program
  .name('tizenbrew-kit')
  .description('Create and package lightweight TizenBrew-compatible web modules')
  .version('0.1.0');

program
  .command('create')
  .argument('<name>', 'project directory name')
  .option(
    '-t, --template <template>',
    'template name: blank|youtube-tv-lite|facebook-reels-lite|noc-dashboard',
  )
  .action(async (name: string, options: { template?: string }) => {
    await createCommand(name, options.template);
  });

program.command('dev').action(async () => {
  await devCommand();
});

program.command('build').action(async () => {
  await buildCommand();
});

program.command('package').action(async () => {
  await packageCommand();
});

program.command('doctor').action(async () => {
  await doctorCommand();
});

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(`[tizenbrew-kit] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
