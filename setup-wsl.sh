#!/bin/bash

# OpenKode WSL Setup Script
# Run this script to set up the backend on WSL

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   🚀 OpenKode WSL Setup                                  ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in WSL
if ! grep -q Microsoft /proc/version && ! grep -q WSL /proc/version; then
    echo -e "${YELLOW}Warning: This script is designed for WSL${NC}"
fi

# Navigate to backend directory
cd "$(dirname "$0")/backend"

echo "📦 Installing dependencies..."
npm install

echo ""
echo "⚙️  Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}✓ Created .env file. Please edit it with your configuration.${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

echo ""
echo "🏗️  Building application..."
npm run build

echo ""
echo "📁 Creating log directory..."
mkdir -p logs

echo ""
echo "🚀 Starting with PM2..."
if command -v pm2 &> /dev/null; then
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "${GREEN}✓ Application started with PM2${NC}"
else
    echo -e "${YELLOW}⚠ PM2 not found. Install with: npm install -g pm2${NC}"
    echo "Starting with node directly..."
    node dist/server.js &
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "Backend is running on: http://localhost:3728"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env with your SMTP and API keys"
echo "  2. Ensure MongoDB is running: sudo systemctl start mongodb"
echo "  3. Check status: pm2 status"
echo "  4. View logs: pm2 logs"
echo ""
echo "To start frontend:"
echo "  cd frontend && npm install && npm start"
echo ""
echo "═══════════════════════════════════════════════════════════"
