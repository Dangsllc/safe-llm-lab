# Safe LLM Lab - Multi-User Deployment Guide

Complete deployment guide for the secure multi-user Safe LLM Lab platform.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React/Vite)  │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
│   Port: 5173    │    │   Port: 3000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐             │
         │              │     Redis       │             │
         └──────────────►│   (Sessions)    │◄────────────┘
                        │   Port: 6379    │
                        └─────────────────┘
```

## 🚀 Production Deployment

### Prerequisites

- **Server**: Ubuntu 20.04+ or similar Linux distribution
- **Node.js**: Version 18+ with npm
- **PostgreSQL**: Version 14+
- **Redis**: Version 6+
- **SSL Certificate**: For HTTPS (Let's Encrypt recommended)
- **Domain**: Configured DNS pointing to your server

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Redis
sudo apt install redis-server -y

# Install Nginx (reverse proxy)
sudo apt install nginx -y

# Install PM2 (process manager)
sudo npm install -g pm2
```

### 2. Database Configuration

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE safe_llm_lab;
CREATE USER safelllm WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE safe_llm_lab TO safelllm;
\q

# Configure PostgreSQL for production
sudo nano /etc/postgresql/14/main/postgresql.conf
# Set: listen_addresses = 'localhost'
# Set: max_connections = 100

sudo nano /etc/postgresql/14/main/pg_hba.conf
# Add: local safe_llm_lab safelllm md5

sudo systemctl restart postgresql
```

### 3. Redis Configuration

```bash
# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: bind 127.0.0.1
# Set: requirepass your-redis-password
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru

sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

### 4. Application Deployment

```bash
# Create application user
sudo adduser safelllm
sudo usermod -aG sudo safelllm

# Switch to application user
sudo su - safelllm

# Clone repository
git clone https://github.com/your-org/safe-llm-lab.git
cd safe-llm-lab

# Backend setup
cd backend
npm install --production
node scripts/setup.js

# Configure production environment
nano .env
# Update all configuration values for production
```

**Production .env Configuration:**
```bash
# Database
DATABASE_URL="postgresql://safelllm:your-secure-password@localhost:5432/safe_llm_lab"

# Redis
REDIS_URL="redis://:your-redis-password@localhost:6379"

# Security (generate new keys)
JWT_ACCESS_SECRET="production-jwt-access-secret-64-chars-minimum"
JWT_REFRESH_SECRET="production-jwt-refresh-secret-64-chars-minimum"
SESSION_SECRET="production-session-secret-32-chars-minimum"
ENCRYPTION_MASTER_KEY="production-encryption-key-32-bytes"
ENCRYPTION_SALT="production-salt-16-bytes"

# Server
PORT=3000
NODE_ENV=production
FRONTEND_URL="https://your-domain.com"

# Email (configure with your SMTP provider)
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT=587
SMTP_USER="your-email@domain.com"
SMTP_PASS="your-app-password"
FROM_EMAIL="noreply@your-domain.com"
```

```bash
# Database migration
npx prisma generate
npx prisma migrate deploy

# Build backend
npm run build

# Frontend setup
cd ../
npm install
npm run build

# Start with PM2
cd backend
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 5. Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/safe-llm-lab
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss:; font-src 'self';" always;

    # Frontend (React app)
    location / {
        root /home/safelllm/safe-llm-lab/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Security
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Server $host;
    }

    # WebSocket connections
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/safe-llm-lab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 7. PM2 Ecosystem Configuration

Create `backend/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'safe-llm-lab-api',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Fail2Ban Setup

```bash
# Install Fail2Ban
sudo apt install fail2ban -y

# Configure for Nginx
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/error.log
findtime = 600
bantime = 7200
maxretry = 10
```

### 3. System Monitoring

```bash
# Install monitoring tools
sudo apt install htop iotop nethogs -y

# Set up log rotation
sudo nano /etc/logrotate.d/safe-llm-lab
```

```
/home/safelllm/safe-llm-lab/backend/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 safelllm safelllm
}
```

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# API health check
curl -f https://your-domain.com/health || echo "API down"

# Database connection
sudo -u postgres psql -d safe_llm_lab -c "SELECT 1;" || echo "DB down"

# Redis connection
redis-cli -a your-redis-password ping || echo "Redis down"
```

### Backup Strategy

```bash
# Database backup script
#!/bin/bash
BACKUP_DIR="/home/safelllm/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# PostgreSQL backup
pg_dump -h localhost -U safelllm safe_llm_lab | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Application files backup
tar -czf "$BACKUP_DIR/app_backup_$DATE.tar.gz" /home/safelllm/safe-llm-lab

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete

# Add to crontab: 0 2 * * * /home/safelllm/backup.sh
```

### Performance Monitoring

```bash
# PM2 monitoring
pm2 monit

# System resources
htop

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Application logs
pm2 logs safe-llm-lab-api
```

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL service: `sudo systemctl status postgresql`
   - Verify credentials in .env file
   - Check pg_hba.conf configuration

2. **Redis Connection Failed**
   - Check Redis service: `sudo systemctl status redis-server`
   - Verify Redis password configuration
   - Check Redis memory usage

3. **SSL Certificate Issues**
   - Renew certificate: `sudo certbot renew`
   - Check certificate expiry: `sudo certbot certificates`

4. **High Memory Usage**
   - Restart PM2 processes: `pm2 restart all`
   - Check for memory leaks in logs
   - Adjust PM2 max_memory_restart setting

### Log Analysis

```bash
# Check application errors
grep -i error /home/safelllm/safe-llm-lab/backend/logs/combined.log

# Monitor authentication failures
grep -i "auth" /home/safelllm/safe-llm-lab/backend/logs/combined.log

# Check security events
grep -i "security" /home/safelllm/safe-llm-lab/backend/logs/combined.log
```

## 📞 Support & Updates

### Updating the Application

```bash
# Pull latest changes
cd /home/safelllm/safe-llm-lab
git pull origin main

# Update backend
cd backend
npm install --production
npm run build

# Update frontend
cd ../
npm install
npm run build

# Restart services
pm2 restart all
```

### Security Updates

- Monitor security advisories for Node.js and dependencies
- Run `npm audit` regularly to check for vulnerabilities
- Keep system packages updated with `sudo apt update && sudo apt upgrade`
- Review and rotate secrets periodically

This deployment guide provides a comprehensive setup for a production-ready, secure multi-user Safe LLM Lab platform.
