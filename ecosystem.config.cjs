/**
 * PM2 Ecosystem Configuration
 *
 * Production deployment configuration for the Nugget News application.
 *
 * Usage:
 *   # Start in production mode
 *   pm2 start ecosystem.config.cjs --env production
 *
 *   # Start in development mode
 *   pm2 start ecosystem.config.cjs --env development
 *
 *   # Reload with zero downtime
 *   pm2 reload ecosystem.config.cjs --env production
 *
 *   # Stop all instances
 *   pm2 stop ecosystem.config.cjs
 *
 *   # Delete from PM2 process list
 *   pm2 delete ecosystem.config.cjs
 *
 *   # View logs
 *   pm2 logs nuggets-api
 *
 *   # Monitor
 *   pm2 monit
 *
 *   # Save current process list for startup
 *   pm2 save
 *
 *   # Setup PM2 to start on boot
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'nuggets-api',
      script: './server/dist/index.js',

      // Cluster mode - use all available CPUs
      instances: 'max', // Or set to specific number like 2, 4, etc.
      exec_mode: 'cluster',

      // Auto-restart settings
      autorestart: true,
      watch: false, // Don't watch in production
      max_memory_restart: '1G', // Restart if memory exceeds 1GB

      // Graceful shutdown
      kill_timeout: 5000, // 5 seconds for graceful shutdown
      wait_ready: true, // Wait for 'ready' signal
      listen_timeout: 10000, // 10 seconds to start

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      combine_logs: true, // Combine logs from all instances
      merge_logs: true,

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Restart on file changes (development only)
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000,
        watch: ['./server/dist'],
        ignore_watch: ['node_modules', 'logs', '.git'],
      },

      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s', // Minimum uptime to consider app started successfully

      // Source map support for error stack traces
      source_map_support: true,

      // Node.js arguments
      node_args: '--enable-source-maps',

      // Cron-based restart (optional - restart daily at 4am)
      // cron_restart: '0 4 * * *',
    },
  ],

  // Deployment configuration (optional - for PM2 deploy)
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'], // Replace with your server
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/nuggets.git', // Replace with your repo
      path: '/var/www/nuggets',
      'pre-deploy-local': '',
      'post-deploy':
        'npm ci && npm run build && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};
