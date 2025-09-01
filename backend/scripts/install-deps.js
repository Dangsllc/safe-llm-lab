#!/usr/bin/env node

// Install backend dependencies for Safe LLM Lab

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Installing Safe LLM Lab Backend Dependencies...\n');

// Check if package.json exists
const packageJsonPath = path.join(__dirname, '..', 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json not found! Run this script from the backend directory.');
  process.exit(1);
}

// Production dependencies
const prodDependencies = [
  'express@^4.18.2',
  '@prisma/client@^5.6.0',
  'prisma@^5.6.0',
  'jsonwebtoken@^9.0.2',
  'argon2@^0.31.2',
  'redis@^4.6.10',
  'ws@^8.14.2',
  'helmet@^7.1.0',
  'cors@^2.8.5',
  'express-rate-limit@^7.1.5',
  'express-validator@^7.0.1',
  'express-session@^1.17.3',
  'connect-redis@^7.1.0',
  'winston@^3.11.0',
  'morgan@^1.10.0',
  'speakeasy@^2.0.0',
  'qrcode@^1.5.3',
  'nodemailer@^6.9.7',
  'multer@^1.4.5-lts.1',
  'joi@^17.11.0',
  'dotenv@^16.3.1'
];

// Development dependencies
const devDependencies = [
  '@types/node@^20.9.0',
  '@types/express@^4.17.21',
  '@types/jsonwebtoken@^9.0.5',
  '@types/ws@^8.5.8',
  '@types/cors@^2.8.16',
  '@types/express-session@^1.17.10',
  '@types/morgan@^1.9.8',
  '@types/speakeasy@^2.0.10',
  '@types/qrcode@^1.5.5',
  '@types/nodemailer@^6.4.14',
  '@types/multer@^1.4.11',
  'typescript@^5.2.2',
  'ts-node@^10.9.1',
  'nodemon@^3.0.1',
  'jest@^29.7.0',
  '@types/jest@^29.5.8',
  'supertest@^6.3.3',
  '@types/supertest@^2.0.16',
  'eslint@^8.54.0',
  '@typescript-eslint/eslint-plugin@^6.12.0',
  '@typescript-eslint/parser@^6.12.0'
];

function runCommand(command, description) {
  console.log(`🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: path.dirname(packageJsonPath) });
    console.log(`✅ ${description} completed\n`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function installDependencies() {
  // Install production dependencies
  console.log('Installing production dependencies...');
  const prodInstallCommand = `npm install ${prodDependencies.join(' ')}`;
  runCommand(prodInstallCommand, 'Production dependencies installation');

  // Install development dependencies
  console.log('Installing development dependencies...');
  const devInstallCommand = `npm install --save-dev ${devDependencies.join(' ')}`;
  runCommand(devInstallCommand, 'Development dependencies installation');
}

function setupTypeScript() {
  const tsconfigPath = path.join(path.dirname(packageJsonPath), 'tsconfig.json');
  
  if (!fs.existsSync(tsconfigPath)) {
    console.log('🔧 Creating TypeScript configuration...');
    
    const tsconfigContent = {
      "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "lib": ["ES2020"],
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "removeComments": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "noImplicitThis": true,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": true,
        "moduleResolution": "node",
        "baseUrl": "./",
        "paths": {
          "@/*": ["src/*"]
        },
        "allowSyntheticDefaultImports": true,
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
      },
      "include": [
        "src/**/*"
      ],
      "exclude": [
        "node_modules",
        "dist",
        "**/*.test.ts",
        "**/*.spec.ts"
      ]
    };

    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));
    console.log('✅ TypeScript configuration created\n');
  }
}

function setupESLint() {
  const eslintConfigPath = path.join(path.dirname(packageJsonPath), '.eslintrc.js');
  
  if (!fs.existsSync(eslintConfigPath)) {
    console.log('🔧 Creating ESLint configuration...');
    
    const eslintConfig = `module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  env: {
    node: true,
    es6: true,
    jest: true,
  },
};`;

    fs.writeFileSync(eslintConfigPath, eslintConfig);
    console.log('✅ ESLint configuration created\n');
  }
}

function updatePackageJsonScripts() {
  console.log('🔧 Updating package.json scripts...');
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  packageJson.scripts = {
    ...packageJson.scripts,
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "nodemon --exec ts-node src/server.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:studio": "prisma studio",
    "db:seed": "ts-node prisma/seed.ts",
    "setup": "node scripts/setup.js"
  };

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Package.json scripts updated\n');
}

function displayNextSteps() {
  console.log('🎉 Backend dependencies installation complete!\n');
  console.log('Next steps:');
  console.log('1. Run setup script: npm run setup');
  console.log('2. Configure your .env file with database and Redis URLs');
  console.log('3. Generate Prisma client: npm run db:generate');
  console.log('4. Run database migrations: npm run db:migrate');
  console.log('5. Start development server: npm run dev\n');
  
  console.log('Available scripts:');
  console.log('- npm run build     # Build TypeScript to JavaScript');
  console.log('- npm run dev       # Start development server with hot reload');
  console.log('- npm run test      # Run test suite');
  console.log('- npm run lint      # Check code style');
  console.log('- npm run db:studio # Open Prisma Studio database GUI\n');
}

// Main execution
function main() {
  try {
    installDependencies();
    setupTypeScript();
    setupESLint();
    updatePackageJsonScripts();
    displayNextSteps();
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    process.exit(1);
  }
}

main();
