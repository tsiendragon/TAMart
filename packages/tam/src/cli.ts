#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { validateCommand } from './commands/validate.js'
import { installCommand } from './commands/install.js'
import { syncCommand } from './commands/sync.js'

const program = new Command()

program
  .name('tam')
  .description('TAMart CLI — cross-platform AI agent component manager')
  .version('0.1.0')

program.addCommand(initCommand())
program.addCommand(validateCommand())
program.addCommand(installCommand())
program.addCommand(syncCommand())

program.parse()
