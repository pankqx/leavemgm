// PM2 process file: keeps the API running, restarts it on crashes and after a reboot.
//   cd backend && pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'leavemgm-api',
      script: 'src/server.js',
      instances: 1,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
