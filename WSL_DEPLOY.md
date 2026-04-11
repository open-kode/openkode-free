# OpenKode WSL Deployment Guide

Deploy OpenKode backend on WSL with PM2 for development/testing.

## Prerequisites

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install MongoDB (or use MongoDB Atlas)
sudo apt-get install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Verify installations
node --version  # v20.x.x
npm --version
pm2 --version
mongo --version
```

## Deployment Steps

### 1. Navigate to Project

```bash
cd /mnt/e/Projects/OpenKode/backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
nano .env
```

**Required .env values:**
```env
NODE_ENV=production
PORT=3728
MONGODB_URI=mongodb://localhost:27017/openkode
JWT_SECRET=your-super-secret-key-here

# SMTP for emails
SMTP_HOST=smtp1.s.ipzmarketing.com
SMTP_PORT=587
SMTP_USER=ejrmpgqqgvkg
SMTP_PASS=your-password-here
FROM_EMAIL=fromlijo@arscnetworks.com

# OpenKode LLM keys (if using OpenKode mode)
OPENKODE_OPENAI_KEY=sk-...
```

### 4. Build the Backend

```bash
npm run build
```

### 5. Create Log Directory

```bash
mkdir -p logs
```

### 6. Start with PM2

```bash
# Start the server
pm2 start ecosystem.config.js --env production

# Or for development
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs openkode-backend

# Monitor
pm2 monit
```

### 7. Save PM2 Config

```bash
# Save current processes
pm2 save

# Setup startup script
pm2 startup systemd
# Run the command PM2 gives you, e.g.:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
```

## PM2 Commands

```bash
# Start
pm2 start openkode-backend

# Restart
pm2 restart openkode-backend

# Stop
pm2 stop openkode-backend

# Delete
pm2 delete openkode-backend

# View logs (real-time)
pm2 logs openkode-backend

# View logs (last 200 lines)
pm2 logs openkode-backend --lines 200

# Clear logs
pm2 flush

# Monitor dashboard
pm2 monit

# Reload (zero-downtime)
pm2 reload openkode-backend
```

## Frontend Development

In a new terminal:

```bash
cd /mnt/e/Projects/OpenKode/frontend
npm install
npm start
```

Frontend will run on `http://localhost:3000`

## Access the Application

- **Backend API**: http://localhost:3728
- **Frontend**: http://localhost:3000

## Troubleshooting

### MongoDB Connection Issues

```bash
# Check MongoDB status
sudo systemctl status mongodb

# Restart MongoDB
sudo systemctl restart mongodb

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

### Port Already in Use

```bash
# Find process using port 3728
sudo lsof -i :3728

# Kill the process
sudo kill -9 <PID>

# Or use a different port in .env
PORT=3729
```

### Permission Denied

```bash
# Fix permissions
sudo chown -R $USER:$USER /mnt/e/Projects/OpenKode/backend/logs
```

### Email Not Sending

1. Check SMTP credentials in `.env`
2. Verify SMTP configuration:
   ```bash
   node -e "require('./dist/services/emailService').verifyEmailConfig().then(console.log)"
   ```

### PM2 Issues

```bash
# Clear PM2 list
pm2 delete all

# Kill PM2 daemon
pm2 kill

# Start fresh
pm2 start ecosystem.config.js
```

## Production Considerations

Before moving to production:

1. **Use MongoDB Atlas** instead of local MongoDB
2. **Set up proper firewall rules** (ufw)
3. **Use Nginx as reverse proxy** with SSL
4. **Set up log rotation** for PM2
5. **Configure monitoring** (PM2 Plus or similar)
6. **Use stronger JWT secret** (64+ character random string)
7. **Enable Stripe live mode** for payments

## Directory Structure

```
/mnt/e/Projects/OpenKode/
├── backend/
│   ├── dist/              # Compiled JS
│   ├── logs/              # PM2 logs
│   ├── node_modules/
│   ├── src/
│   ├── .env               # Your config
│   ├── ecosystem.config.js
│   └── package.json
└── frontend/
    ├── build/             # Production build
    ├── node_modules/
    ├── src/
    └── package.json
```

## Updating the Application

```bash
cd /mnt/e/Projects/OpenKode/backend

# Pull latest changes (if using git)
git pull

# Install new dependencies
npm install

# Rebuild
npm run build

# Reload PM2
pm2 reload openkode-backend

# Check status
pm2 status
```

## Viewing Logs

```bash
# Backend logs
pm2 logs openkode-backend

# Or view log files directly
tail -f /mnt/e/Projects/OpenKode/backend/logs/out.log
tail -f /mnt/e/Projects/OpenKode/backend/logs/error.log
```

## Backup Database

```bash
# Backup
mongodump --db openkode --out /backup/openkode-$(date +%Y%m%d)

# Restore
mongorestore --db openkode /backup/openkode-20240101/openkode
```
