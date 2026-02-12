// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'cce-engine',
      script: 'server.js',
      instances: 1,
      autorestart: true
    },
    {
      name: 'cloud-sync',
      script: 'cloud-sync.js',
      instances: 1,
      cron_restart: '0 */4 * * *', // Every 4 hours
      autorestart: false
    }
  ]
};