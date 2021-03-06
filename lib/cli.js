#!/usr/bin/env node
import path from 'path'
import meow from 'meow'
import fs from 'fs-extra'
import chalk from 'chalk'
import updateNotifier from 'update-notifier'
import createCallsiteRecord from 'callsite-record'
import airForSteam from './index'
import pkg from '../package.json'
import updateConfig from './actions/configure'
import firstTimeSetup from './actions/setup'
import updateAirForSteam from './actions/update'
import reinstallSkin from './actions/reinstall-skin'
import debug from './utils/debug'
import config from './utils/config'

updateNotifier({ pkg }).notify()

const cli = meow({
  help: `
        Usage
          $ airforsteam

        Options
          --debug                Debug output. Throw in a gist when creating issues on github.
          -u, --update           Update Air for Steam without configuring
          -e, --edit-existing    Edit existing install
          -c, --get-config       Outputs your current configuration
          -r, --reinstall        Re-installs the skin with your current configuration

        Examples
          $ airforsteam          # Update configuration, then update Air for Steam
          $ airforsteam -u       # Update Air for Steam & apply previous config
          $ airforsteam -e       # Edit installed skin. (Potentially dangerous)
    ` },
{
  alias: {
    u: 'update',
    e: 'edit-existing',
    c: 'get-config',
    r: 'reinstall',
  },
  boolean: [
    'update',
    'edit-existing',
    'get-config',
    'reinstall',
  ],
})

const options = {
  debug: cli.flags.debug || false,
  update: cli.flags.u || false,
  editExisting: cli.flags.e || false,
  outputConfig: cli.flags.c || false,
  reInstall: cli.flags.r || false,
}

if (options.debug) {
  debug('cli.flags', cli.flags)
  debug('cli.input', cli.input)
}
const state = airForSteam(options)
try {
  if (state.get('editExisting') && state.get('update')) {
    console.error(chalk.red('You can not update and edit an existing installation at the same time.'))
    process.exit(1)
  }
  config.init(state)

  if (state.get('outputConfig')) {
    console.log(config.readAnonymous(state))
    process.exit(0)
  }

  if (state.get('reInstall')) {
    reinstallSkin(state).then(() => {
      process.exit(0)
    })
  }

  if (state.get('firstRun')) {
    if (state.get('editExisting')) {
      console.error(chalk.red('Disabling edit-existing, as this is your first run.'))
      state.set('editExisting', false)
    }
    firstTimeSetup(state).then(() => {
      process.exit(0)
    })
  }

  if (state.get('editExisting')) {
    if (state.get('installLocation') === '') {
      console.error(chalk.red(`Cannot edit existing, as the installation directory is unknown.`))
      process.exit(1)
    }
    if (!fs.existsSync(path.resolve(state.get('installLocation'), 'config.ini'))) {
      console.error(chalk.red(`Cannot edit existing, as ${state.get('installLocation')} does not exist.`))
      process.exit(1)
    }
  }

  if (state.get('update')) {
    updateAirForSteam(state).then(() => {
      process.exit(0)
    })
  }

  updateConfig(state)
} catch (err) {
  if (options.debug) {
    console.error(chalk.red(err.message))
    console.log(createCallsiteRecord({ forError: err }).renderSync())
  } else if (err.message === 'out-of-date') {
    console.log(chalk.green(config.readAnonymous(state)))
    console.error(chalk.red('[airforsteam] It would appear as though this tool is out of date.'))
    console.error(chalk.red('[airforsteam] Usually that means that something in the folder structure'))
    console.error(chalk.red('[airforsteam] of Air-for-Steam has changed, and this project needs'))
    console.error(chalk.red('[airforsteam] to be updated to reflect those changes.'))
    console.error(chalk.red('[airforsteam] You can open an issue on GitHub here https://github.com/nysos3/airforsteam-config/issues'))
    console.error(chalk.red('[airforsteam] Please supply all output from this run in your issue.'))
  } else {
    console.error(chalk.red(err.message))
    console.log(createCallsiteRecord({ forError: err }).renderSync())
    console.log('For more detail, add `--debug` to the command')
  }
  process.exit(1)
}
