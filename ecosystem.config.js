/**
 * PM2 Configuration for OpenKode (Frontend + Backend)
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    // Backend Application
    {
      name: "openkode-backend",
      script: "./backend/dist/server.js",
      instances: 1,
      exec_mode: "fork",

      // Environment variables
      env: {
        NODE_ENV: "development",
        PORT: 3728,
        MONGODB_URI: "mongodb://localhost:27017/openkode",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3728,
        MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/openkode",
      },

      // Logging
      log_file: "./logs/backend-combined.log",
      out_file: "./logs/backend-out.log",
      error_file: "./logs/backend-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Auto-restart
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",

      // Memory management
      max_memory_restart: "1G",

      // Monitoring
      monitoring: true,

      // Advanced
      kill_timeout: 5000,
      listen_timeout: 10000,
    },

    // Frontend Development Server
    {
      name: "openkode-frontend",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      cwd: "./frontend",

      // Environment variables
      env: {
        NODE_ENV: "development",
        PORT: 3232,
        REACT_APP_API_URL: "http://localhost:3728",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3232,
        REACT_APP_API_URL: "http://localhost:3728",
      },

      // Logging
      log_file: "./logs/frontend-combined.log",
      out_file: "./logs/frontend-out.log",
      error_file: "./logs/frontend-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Auto-restart
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",

      // Memory management
      max_memory_restart: "1G",

      // Monitoring
      monitoring: true,

      // Advanced
      kill_timeout: 5000,
      listen_timeout: 15000,
    },
  ],
};
