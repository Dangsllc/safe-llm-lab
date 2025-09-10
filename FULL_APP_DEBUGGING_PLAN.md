# Full App Issue Identification Plan

## Overview
Systematic approach to identify and resolve issues when Safe LLM Lab runs with all features enabled (authentication, backend API, multi-user collaboration).

## Phase 1: Pre-Flight Diagnostics

### 1.1 Environment Setup Verification
- [ ] Check `.env` file exists and contains required variables
- [ ] Verify `VITE_API_URL`, `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`
- [ ] Validate environment variable formats and values
- [ ] Test environment variable loading in both frontend and backend

### 1.2 Dependency Analysis
- [ ] Frontend dependencies installed (`node_modules` exists)
- [ ] Backend dependencies installed (`backend/node_modules` exists)
- [ ] Version compatibility check between frontend and backend packages
- [ ] Check for conflicting package versions

### 1.3 Infrastructure Requirements
- [ ] PostgreSQL database availability
- [ ] Redis server availability  
- [ ] Port availability (3000 for API, 5173 for Vite, 6379 for Redis)
- [ ] Network connectivity between services

## Phase 2: Startup Sequence Analysis

### 2.1 Frontend Initialization
- [ ] Vite configuration validation (`vite.config.ts`)
- [ ] TypeScript configuration (`tsconfig.json`)
- [ ] Path alias resolution (`@/` imports)
- [ ] React component mounting sequence

### 2.2 Context Provider Chain
- [ ] `QueryClientProvider` initialization
- [ ] `AuthProvider` startup and token validation
- [ ] `StudyProvider` dependency on authentication
- [ ] Error boundary activation points

### 2.3 API Client Initialization
- [ ] Base URL configuration
- [ ] Authentication token handling
- [ ] Request/response interceptors
- [ ] Timeout and retry logic

## Phase 3: Runtime Error Detection

### 3.1 Authentication Flow Testing
- [ ] Initial auth state determination
- [ ] Token refresh mechanism
- [ ] MFA setup and verification
- [ ] Session management and cleanup

### 3.2 API Connectivity Testing
- [ ] Backend server availability
- [ ] Endpoint accessibility (`/api/auth`, `/api/studies`)
- [ ] CORS configuration
- [ ] Request/response format validation

### 3.3 Database Integration
- [ ] Prisma client initialization
- [ ] Database schema synchronization
- [ ] Migration status
- [ ] Connection pooling and timeouts

## Phase 4: Feature-Specific Testing

### 4.1 Study Management
- [ ] Study creation and retrieval
- [ ] Collaborator management
- [ ] Permission validation
- [ ] Real-time updates

### 4.2 Security Features
- [ ] Input sanitization
- [ ] Secure storage encryption/decryption
- [ ] Audit logging
- [ ] Session security

### 4.3 Real-time Collaboration
- [ ] WebSocket connection establishment
- [ ] Message encryption/decryption
- [ ] User presence tracking
- [ ] Conflict resolution

## Phase 5: Error Classification and Resolution

### 5.1 Critical Errors (App Won't Start)
- Missing environment variables
- Database connection failures
- Port conflicts
- Missing dependencies

### 5.2 Runtime Errors (App Starts But Features Fail)
- Authentication failures
- API endpoint errors
- Permission denied errors
- WebSocket connection issues

### 5.3 Performance Issues
- Slow initial load
- Memory leaks
- Excessive API calls
- Unoptimized re-renders

## Tools and Scripts

### Diagnostic Tools
- `debug-full-app.js` - Comprehensive system check
- `test-full-app-startup.bat` - Automated startup testing
- Browser DevTools - Network, Console, Application tabs
- Backend logs - Express server logs, database logs

### Testing Scripts
```bash
# Run full diagnostic
node debug-full-app.js

# Test startup with error capture
test-full-app-startup.bat

# Backend health check
cd backend && npm run health-check

# Database connectivity test
cd backend && npx prisma db push --preview-feature
```

### Monitoring Commands
```bash
# Check running processes
netstat -ano | findstr :3000
netstat -ano | findstr :5173
netstat -ano | findstr :6379

# View real-time logs
tail -f debug-full-app.log
tail -f backend/logs/app.log
```

## Common Issue Patterns

### Pattern 1: Backend Not Running
**Symptoms:** API calls fail, authentication doesn't work
**Solution:** Start backend server, check database connection

### Pattern 2: Environment Misconfiguration
**Symptoms:** Undefined variables, connection errors
**Solution:** Verify .env file, check variable names and values

### Pattern 3: Port Conflicts
**Symptoms:** Server won't start, EADDRINUSE errors
**Solution:** Kill conflicting processes, use alternative ports

### Pattern 4: Authentication Loop
**Symptoms:** Infinite loading, repeated auth requests
**Solution:** Check token validation, clear stored tokens

### Pattern 5: CORS Issues
**Symptoms:** Network errors in browser, preflight failures
**Solution:** Configure backend CORS settings, check origins

## Success Criteria

### Minimum Viable Startup
- [ ] Vite dev server starts without errors
- [ ] React app renders without console errors
- [ ] Authentication context initializes
- [ ] Basic navigation works

### Full Feature Functionality
- [ ] User can log in/register
- [ ] Studies can be created and managed
- [ ] API calls succeed
- [ ] Real-time features work
- [ ] Security features active

### Performance Benchmarks
- [ ] Initial load < 3 seconds
- [ ] API response times < 500ms
- [ ] Memory usage stable
- [ ] No memory leaks detected

## Escalation Path

1. **Level 1:** Run diagnostic tools, check logs
2. **Level 2:** Isolate components, test individually  
3. **Level 3:** Enable debug mode, add detailed logging
4. **Level 4:** Fallback to lite mode, document issues
5. **Level 5:** Architecture review, consider alternatives
