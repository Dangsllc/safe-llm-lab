#!/usr/bin/env node

// Setup script for Safe LLM Lab backend

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔧 Setting up Safe LLM Lab Backend...\n');

// Generate secure random keys
function generateSecureKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateJWTSecret() {
  return crypto.randomBytes(64).toString('base64');
}

// Create .env file from template
function createEnvFile() {
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  const envPath = path.join(__dirname, '..', '.env');

  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists. Skipping generation.');
    return;
  }

  if (!fs.existsSync(envExamplePath)) {
    console.error('❌ .env.example file not found!');
    process.exit(1);
  }

  let envContent = fs.readFileSync(envExamplePath, 'utf8');

  // Replace placeholder values with secure generated keys
  const replacements = {
    'your-super-secret-jwt-access-key-change-in-production': generateJWTSecret(),
    'your-super-secret-jwt-refresh-key-change-in-production': generateJWTSecret(),
    'your-super-secret-session-key-change-in-production': generateSecureKey(32),
    'your-32-byte-encryption-master-key-change-in-production': generateSecureKey(32),
    'your-encryption-salt-change-in-production': generateSecureKey(16)
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    envContent = envContent.replace(placeholder, value);
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Generated .env file with secure random keys');
}

// Check required dependencies
function checkDependencies() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json not found!');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredDeps = [
    'express',
    'prisma',
    '@prisma/client',
    'jsonwebtoken',
    'argon2',
    'redis',
    'ws'
  ];

  const missingDeps = requiredDeps.filter(dep => 
    !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
  );

  if (missingDeps.length > 0) {
    console.log('⚠️  Missing required dependencies:');
    missingDeps.forEach(dep => console.log(`   - ${dep}`));
    console.log('\nRun: npm install to install missing dependencies');
  } else {
    console.log('✅ All required dependencies are present');
  }
}

// Create necessary directories
function createDirectories() {
  const dirs = [
    'logs',
    'uploads',
    'backups'
  ];

  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ Created directory: ${dir}/`);
    }
  });
}

// Display setup instructions
function displayInstructions() {
  console.log('\n🎉 Backend setup complete!\n');
  console.log('Next steps:');
  console.log('1. Install dependencies: npm install');
  console.log('2. Set up PostgreSQL database');
  console.log('3. Set up Redis server');
  console.log('4. Update DATABASE_URL and REDIS_URL in .env');
  console.log('5. Generate Prisma client: npx prisma generate');
  console.log('6. Run database migrations: npx prisma migrate dev');
  console.log('7. Start development server: npm run dev\n');
  
  console.log('🔒 Security Notes:');
  console.log('- Change all generated keys before production deployment');
  console.log('- Use environment-specific configuration for production');
  console.log('- Enable SSL/TLS for database and Redis connections');
  console.log('- Set up proper firewall rules and network security');
  console.log('- Configure backup and disaster recovery procedures\n');
}

// Main setup function
function main() {
  try {
    createEnvFile();
    checkDependencies();
    createDirectories();
    displayInstructions();
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
main();
