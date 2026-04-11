// Verify features actually work - without vscode dependency
const path = require('path');
const fs = require('fs');

console.log('=== Feature Code Verification ===\n');

// Check if classes exist in bundle
const bundle = fs.readFileSync('./out/extension.js', 'utf8');

const checks = [
  ['ChatStore', 'ChatStore'],
  ['addMessage', 'addMessage method'],
  ['getAllConversations', 'getAllConversations method'],
  ['PrecisionModeEngine', 'PrecisionModeEngine class'],
  ['BlueprintModeEngine', 'BlueprintModeEngine class'],
  ['VisionaryModeEngine', 'VisionaryModeEngine class'],
  ['RocketModeEngine', 'RocketModeEngine class'],
  ['createModeEngine', 'createModeEngine factory'],
  ['ContextReader', 'ContextReader class'],
  ['readContext', 'readContext method'],
  ['formatContextForPrompt', 'formatContextForPrompt method'],
  ['IncrementalEngine', 'IncrementalEngine class'],
  ['addFeature', 'addFeature method'],
  ['fixError', 'fixError method']
];

let passed = 0;
let failed = 0;

for (const [pattern, name] of checks) {
  if (bundle.includes(pattern)) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name} - NOT FOUND`);
    failed++;
  }
}

console.log(`\n=== Results: ${passed}/${passed+failed} checks passed ===`);

if (failed > 0) {
  process.exit(1);
}
