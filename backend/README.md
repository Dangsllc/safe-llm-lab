# Safe LLM Lab - Secure Multi-User Backend

Enterprise-grade backend infrastructure for Safe LLM Lab with comprehensive security, authentication, and collaboration features.

## 🔒 Security Features

- **Zero Trust Architecture** with defense-in-depth
- **End-to-End Encryption** for all user data
- **Multi-Factor Authentication** (TOTP-based)
- **Role-Based Access Control** with study-level permissions
- **Comprehensive Audit Logging** with tamper detection
- **Real-Time Collaboration** via encrypted WebSocket connections
- **Input Sanitization** and validation on all endpoints
- **Rate Limiting** and DDoS protection
- **Secure Session Management** with Redis

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+

### Installation

1. **Clone and setup**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations
   npx prisma migrate dev
   
   # Seed initial data (optional)
   npm run seed
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

### Production Deployment

1. **Build Application**
   ```bash
   npm run build
   ```

2. **Database Migration**
   ```bash
   npm run migrate:prod
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Security and app configuration
│   ├── middleware/      # Security middleware (auth, validation, etc.)
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic services
│   ├── types/           # TypeScript type definitions
│   └── server.ts        # Express server setup
├── prisma/
│   └── schema.prisma    # Database schema
└── package.json
```

## 🔐 Authentication Flow

1. **User Registration**
   - Email/password with strong validation
   - Role assignment (admin, researcher, analyst, viewer)
   - Email verification (optional)

2. **Login Process**
   - Credential validation with rate limiting
   - MFA verification (if enabled)
   - JWT token generation (access + refresh)
   - Secure session creation

3. **Session Management**
   - Redis-backed session storage
   - Automatic token refresh
   - Activity-based session timeout
   - Secure logout with token invalidation

## 🏢 Multi-User Collaboration

### Study Ownership & Roles

- **Owner**: Full control (edit, delete, manage collaborators)
- **Editor**: Edit study settings and manage content
- **Contributor**: Add test sessions and templates
- **Viewer**: Read-only access to study data

### Real-Time Features

- Live study updates via WebSocket
- Collaborative test session creation
- Template sharing and modifications
- User presence indicators

## 🛡️ Security Implementation

### Data Protection

- **Encryption at Rest**: AES-256-GCM for sensitive data
- **Encryption in Transit**: TLS 1.3 for all connections
- **Field-Level Encryption**: User-specific encryption keys
- **Secure Key Management**: Master key with user derivation

### Access Control

- **JWT Authentication**: Stateless token validation
- **Permission-Based Authorization**: Granular access control
- **Row-Level Security**: Database-enforced data isolation
- **API Rate Limiting**: Per-user and global limits

### Audit & Monitoring

- **Security Event Logging**: All authentication and access events
- **Anomaly Detection**: Suspicious activity identification
- **Audit Trail Integrity**: Tamper-proof logging with checksums
- **Real-Time Alerts**: Critical security event notifications

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/login/mfa` - MFA verification
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - Secure logout
- `GET /api/auth/me` - Current user info

### Studies
- `GET /api/studies` - List user studies
- `POST /api/studies` - Create new study
- `GET /api/studies/:id` - Get study details
- `PUT /api/studies/:id` - Update study
- `DELETE /api/studies/:id` - Delete study

### Collaboration
- `POST /api/studies/:id/collaborators` - Invite collaborator
- `GET /api/studies/:id/collaborators` - List collaborators
- `PATCH /api/studies/:id/collaborators/:userId` - Update role
- `DELETE /api/studies/:id/collaborators/:userId` - Remove collaborator

### Sessions & Templates
- `GET /api/studies/:id/sessions` - List test sessions
- `POST /api/studies/:id/sessions` - Create session
- `GET /api/templates` - List prompt templates
- `POST /api/templates` - Create template

## 🔍 Development

### Running Tests
```bash
npm test                 # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:security   # Security tests
```

### Database Operations
```bash
npm run db:reset        # Reset database
npm run db:seed         # Seed test data
npm run db:studio       # Open Prisma Studio
```

### Security Scanning
```bash
npm audit               # Dependency vulnerability scan
npm run security:scan   # Custom security checks
```

## 📊 Monitoring & Logs

### Health Checks
- `GET /health` - Basic health status
- `GET /health/detailed` - Comprehensive system status

### Metrics
- Authentication success/failure rates
- API response times and error rates
- Database connection pool status
- Redis cache hit rates
- WebSocket connection counts

### Log Levels
- **ERROR**: System errors and security violations
- **WARN**: Security warnings and unusual activity
- **INFO**: Normal operations and user actions
- **DEBUG**: Detailed debugging information (dev only)

## 🔒 Security Best Practices

1. **Environment Variables**: Never commit secrets to version control
2. **Database Security**: Use connection pooling and prepared statements
3. **Input Validation**: Sanitize and validate all user inputs
4. **Error Handling**: Don't expose sensitive information in errors
5. **Dependency Management**: Regularly update and audit dependencies
6. **Backup Strategy**: Encrypted backups with secure key management

## 📞 Support

For security issues or questions:
- Create a GitHub issue with the `security` label
- For critical vulnerabilities, contact the security team directly

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
