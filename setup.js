#!/usr/bin/env node
/**
 * OpenKode Setup Script
 * 
 * Sets up the development environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 OpenKode Setup                                      ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);

const steps = [
  {
    name: 'Extension Dependencies',
    cwd: '.',
    command: 'npm install'
  },
  {
    name: 'Backend Dependencies',
    cwd: 'backend',
    command: 'npm install'
  },
  {
    name: 'Frontend Dependencies',
    cwd: 'frontend',
    command: 'npm install'
  },
  {
    name: 'Build Extension',
    cwd: '.',
    command: 'npm run compile'
  },
  {
    name: 'Build Backend',
    cwd: 'backend',
    command: 'npx tsc'
  },
  {
    name: 'Build Frontend',
    cwd: 'frontend',
    command: 'npm run build'
  }
];

async function runSetup() {
  for (const step of steps) {
    console.log(`\n📦 ${step.name}...`);
    
    try {
      const cwd = path.join(__dirname, step.cwd);
      
      // Check if directory exists
      if (!fs.existsSync(cwd)) {
        console.log(`  Creating directory: ${step.cwd}`);
        fs.mkdirSync(cwd, { recursive: true });
      }
      
      execSync(step.command, {
        cwd,
        stdio: 'inherit'
      });
      
      console.log(`  ✅ ${step.name} complete`);
    } catch (error) {
      console.error(`  ❌ ${step.name} failed:`, error.message);
      process.exit(1);
    }
  }

  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ✅ Setup Complete!                                     ║
║                                                          ║
║   Next steps:                                            ║
║   1. Open VS Code                                        ║
║   2. Press F5 to launch extension                        ║
║   3. Run "OpenKode: Open OpenKode UI" command            ║
║                                                          ║
║   Or run backend manually:                               ║
║   cd backend && npm run dev                              ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
}

runSetup().catch(console.error);
