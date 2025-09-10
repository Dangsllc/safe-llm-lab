// Comprehensive debugging tool for full app startup issues
import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FullAppDebugger {
  constructor() {
    this.logFile = path.join(__dirname, 'debug-full-app.log');
    this.results = {
      timestamp: new Date().toISOString(),
      checks: [],
      errors: [],
      warnings: [],
      recommendations: []
    };
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type}: ${message}`;
    console.log(logEntry);
    
    // Append to log file
    fs.appendFileSync(this.logFile, logEntry + '\n');
    
    this.results.checks.push({
      timestamp,
      type,
      message
    });
  }

  async checkEnvironmentVariables() {
    this.log('=== CHECKING ENVIRONMENT VARIABLES ===');
    
    const requiredEnvVars = [
      'VITE_API_URL',
      'DATABASE_URL',
      'JWT_SECRET',
      'REDIS_URL'
    ];

    const envFile = path.join(__dirname, '.env');
    const envExampleFile = path.join(__dirname, '.env.example');

    // Check if .env exists
    if (!fs.existsSync(envFile)) {
      this.results.errors.push('Missing .env file');
      this.log('ERROR: .env file not found', 'ERROR');
      
      if (fs.existsSync(envExampleFile)) {
        this.results.recommendations.push('Copy .env.example to .env and configure variables');
        this.log('RECOMMENDATION: Copy .env.example to .env', 'WARN');
      }
    } else {
      this.log('.env file found', 'SUCCESS');
      
      // Read and check environment variables
      const envContent = fs.readFileSync(envFile, 'utf8');
      requiredEnvVars.forEach(varName => {
        if (envContent.includes(`${varName}=`)) {
          this.log(`✓ ${varName} is defined`, 'SUCCESS');
        } else {
          this.results.warnings.push(`Missing environment variable: ${varName}`);
          this.log(`✗ ${varName} is missing`, 'WARN');
        }
      });
    }
  }

  async checkBackendDependencies() {
    this.log('=== CHECKING BACKEND DEPENDENCIES ===');
    
    const backendDir = path.join(__dirname, 'backend');
    const backendPackageJson = path.join(backendDir, 'package.json');
    const nodeModules = path.join(backendDir, 'node_modules');

    if (!fs.existsSync(backendDir)) {
      this.results.errors.push('Backend directory not found');
      this.log('ERROR: Backend directory missing', 'ERROR');
      return;
    }

    if (!fs.existsSync(backendPackageJson)) {
      this.results.errors.push('Backend package.json not found');
      this.log('ERROR: Backend package.json missing', 'ERROR');
      return;
    }

    if (!fs.existsSync(nodeModules)) {
      this.results.warnings.push('Backend node_modules not found - dependencies not installed');
      this.log('WARN: Backend dependencies not installed', 'WARN');
      this.results.recommendations.push('Run: cd backend && npm install');
    } else {
      this.log('✓ Backend dependencies appear to be installed', 'SUCCESS');
    }
  }

  async checkFrontendDependencies() {
    this.log('=== CHECKING FRONTEND DEPENDENCIES ===');
    
    const packageJson = path.join(__dirname, 'package.json');
    const nodeModules = path.join(__dirname, 'node_modules');

    if (!fs.existsSync(packageJson)) {
      this.results.errors.push('Frontend package.json not found');
      this.log('ERROR: Frontend package.json missing', 'ERROR');
      return;
    }

    if (!fs.existsSync(nodeModules)) {
      this.results.warnings.push('Frontend node_modules not found - dependencies not installed');
      this.log('WARN: Frontend dependencies not installed', 'WARN');
      this.results.recommendations.push('Run: npm install');
    } else {
      this.log('✓ Frontend dependencies appear to be installed', 'SUCCESS');
    }
  }

  async checkDatabaseConnection() {
    this.log('=== CHECKING DATABASE CONNECTION ===');
    
    const prismaSchema = path.join(__dirname, 'backend', 'prisma', 'schema.prisma');
    
    if (!fs.existsSync(prismaSchema)) {
      this.results.warnings.push('Prisma schema not found');
      this.log('WARN: Prisma schema missing', 'WARN');
      return;
    }

    this.log('✓ Prisma schema found', 'SUCCESS');
    this.results.recommendations.push('Test database connection with: cd backend && npx prisma db push');
  }

  async checkPortAvailability() {
    this.log('=== CHECKING PORT AVAILABILITY ===');
    
    const ports = [3000, 5173, 6379]; // Backend API, Vite dev, Redis
    
    for (const port of ports) {
      try {
        // exec is already imported at the top
        const command = process.platform === 'win32' 
          ? `netstat -ano | findstr :${port}`
          : `lsof -i :${port}`;
          
        exec(command, (error, stdout) => {
          if (stdout && stdout.trim()) {
            this.results.warnings.push(`Port ${port} is in use`);
            this.log(`WARN: Port ${port} is already in use`, 'WARN');
          } else {
            this.log(`✓ Port ${port} is available`, 'SUCCESS');
          }
        });
      } catch (error) {
        this.log(`Could not check port ${port}: ${error.message}`, 'WARN');
      }
    }
  }

  async testViteStartup() {
    this.log('=== TESTING VITE STARTUP ===');
    
    return new Promise((resolve) => {
      const viteProcess = spawn('npm', ['run', 'dev'], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      
      const timeout = setTimeout(() => {
        viteProcess.kill();
        this.log('Vite startup test timed out after 30 seconds', 'WARN');
        resolve(false);
      }, 30000);

      viteProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Local:') && output.includes('5173')) {
          clearTimeout(timeout);
          viteProcess.kill();
          this.log('✓ Vite server started successfully', 'SUCCESS');
          resolve(true);
        }
      });

      viteProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      viteProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0 && errorOutput) {
          this.results.errors.push(`Vite startup failed: ${errorOutput}`);
          this.log(`ERROR: Vite failed to start: ${errorOutput}`, 'ERROR');
        }
        resolve(code === 0);
      });
    });
  }

  async checkImportPaths() {
    this.log('=== CHECKING IMPORT PATHS ===');
    
    const criticalFiles = [
      'src/App.tsx',
      'src/contexts/AuthContext.tsx',
      'src/contexts/StudyContext.tsx',
      'src/lib/api/client.ts',
      'src/lib/api/studies.ts'
    ];

    for (const file of criticalFiles) {
      const filePath = path.join(__dirname, file);
      if (!fs.existsSync(filePath)) {
        this.results.errors.push(`Critical file missing: ${file}`);
        this.log(`ERROR: Missing critical file: ${file}`, 'ERROR');
      } else {
        this.log(`✓ Found: ${file}`, 'SUCCESS');
        
        // Check for common import issues
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('@/') && !fs.existsSync(path.join(__dirname, 'tsconfig.json'))) {
          this.results.warnings.push(`${file} uses path aliases but tsconfig.json might be misconfigured`);
        }
      }
    }
  }

  async generateReport() {
    this.log('=== GENERATING DIAGNOSTIC REPORT ===');
    
    const report = {
      ...this.results,
      summary: {
        totalChecks: this.results.checks.length,
        errors: this.results.errors.length,
        warnings: this.results.warnings.length,
        recommendations: this.results.recommendations.length
      }
    };

    const reportFile = path.join(__dirname, 'full-app-diagnostic-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    this.log(`Diagnostic report saved to: ${reportFile}`, 'SUCCESS');
    
    // Generate human-readable summary
    console.log('\n' + '='.repeat(60));
    console.log('FULL APP DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Checks: ${report.summary.totalChecks}`);
    console.log(`Errors: ${report.summary.errors}`);
    console.log(`Warnings: ${report.summary.warnings}`);
    console.log(`Recommendations: ${report.summary.recommendations}`);
    
    if (report.summary.errors > 0) {
      console.log('\nCRITICAL ERRORS:');
      this.results.errors.forEach(error => console.log(`  ❌ ${error}`));
    }
    
    if (report.summary.warnings > 0) {
      console.log('\nWARNINGS:');
      this.results.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }
    
    if (report.summary.recommendations > 0) {
      console.log('\nRECOMMENDATIONS:');
      this.results.recommendations.forEach(rec => console.log(`  💡 ${rec}`));
    }
    
    console.log('='.repeat(60));
  }

  async runFullDiagnostic() {
    console.log('Starting Full App Diagnostic...\n');
    
    await this.checkEnvironmentVariables();
    await this.checkFrontendDependencies();
    await this.checkBackendDependencies();
    await this.checkDatabaseConnection();
    await this.checkPortAvailability();
    await this.checkImportPaths();
    
    // Wait a moment for port checks to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.generateReport();
  }
}

// Run diagnostic if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const appDebugger = new FullAppDebugger();
  appDebugger.runFullDiagnostic().catch(console.error);
}

export default FullAppDebugger;
