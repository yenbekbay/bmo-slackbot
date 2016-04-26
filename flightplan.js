'use strict';

const plan = require('flightplan');
require('dotenv').config();

const Ecosystem = require('./ecosystem.json');

const appName = Ecosystem.apps[0].name;

const host = process.env.REMOTE_HOST;
const user = process.env.REMOTE_USER;
const agent = process.env.SSH_AUTH_SOCK;
const privateKey = process.env.PRIVATE_KEY;

plan.target('production', [{
  host: host,
  username: user,
  agent: agent,
  privateKey: privateKey
}]);

const tmpDir = `/tmp/${appName}-${new Date().getTime()}`;

plan.local('deploy', local => {
  local.log('Copy files to remote host');
  const files = local
    .git('ls-files', { silent: true }).stdout.split('\n')
    .concat(['.git', '.env']);
  local.transfer(files, tmpDir);
});

plan.remote('deploy', remote => {
  remote.log('Install dependencies');
  remote.exec(`npm --production --prefix ${tmpDir} install ${tmpDir}`);

  remote.log('Move folder to web root');
  remote.exec(`rsync -az --delete ${tmpDir}/ ~/${appName}`);
  remote.rm(`-rf ${tmpDir}`);

  remote.log('Restart application');
  remote.exec(`cd ~/${appName} && sudo pm2 startOrRestart ecosystem.json`);
});
