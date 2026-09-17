# Zorah Backend Deployment & Infrastructure Guide

This document provides a comprehensive operational guide for deploying, managing, and maintaining the **Zorah Backend** on AWS EC2 infrastructure.

---

## 1. System Architecture Overview

The Zorah backend employs a **dual-port single-server architecture** managed by **PM2** (Process Manager 2) behind an **Nginx** reverse proxy. This architecture allows both Production and Staging environments to co-exist cleanly on a single EC2 instance while maintaining strict isolation of databases, environment variables, third-party API credentials, and network ports.

```
                         +-----------------------------------+
                         |         Clients / Web App         |
                         +-----------------------------------+
                                           |
                                           v
                         +-----------------------------------+
                         |           AWS EC2 Host            |
                         |   Security Group Ports:           |
                         |   22 (SSH), 80 (HTTP), 443 (HTTPS) |
                         +-----------------------------------+
                                           |
                                           v
                         +-----------------------------------+
                         |        Nginx Reverse Proxy        |
                         |      (/etc/nginx/conf.d/*.conf)   |
                         +-----------------------------------+
                                 /                   \
        proxy_pass http://127.0.0.1:4000       proxy_pass http://127.0.0.1:4001
                               /                       \
                              v                         v
       +-------------------------------+       +-------------------------------+
       | PM2 Process: zorah-backend    |       | PM2 Process: zorah-staging    |
       | Port: 4000                    |       | Port: 4001                    |
       | Config: .env.production       |       | Config: .env.staging          |
       | Database: zorah_production    |       | Database: zorah_staging       |
       | Keys: Xpress Live             |       | Keys: Xpress Sandbox          |
       +-------------------------------+       +-------------------------------+
                      |                                       |
                      v                                       v
       +-------------------------------+       +-------------------------------+
       | MongoDB Atlas (Production DB) |       |  MongoDB Atlas (Staging DB)   |
       +-------------------------------+       +-------------------------------+
```

---

## 2. Dual-Port PM2 Configuration

PM2 manages application instances defined in `ecosystem.config.cjs`. Each environment runs as an isolated process with dedicated port bindings and environment variables.

### Environment Specification Matrix

| Feature / Setting | Production Environment | Staging Environment |
| :--- | :--- | :--- |
| **PM2 Process Name** | `zorah-backend` | `zorah-staging` |
| **Port Binding** | `4000` | `4001` |
| **Environment File** | `.env.production` | `.env.staging` |
| **`NODE_ENV` Value** | `production` | `staging` |
| **MongoDB Database** | `zorah_production` | `zorah_staging` |
| **Xpress Wallet Keys** | Production / Live (`sk_live_...`) | Sandbox / Test (`sk_sandbox_...`) |
| **Working Directory** | `/home/ec2-user/Zorah` or `/var/www/zorah` | `/home/ec2-user/Zorah` or `/var/www/zorah` |

### Ecosystem Config File (`ecosystem.config.cjs`)

```javascript
module.exports = {
  apps: [
    {
      name: "zorah-backend",
      script: "./src/app.js",
      cwd: "/home/ec2-user/Zorah",
      env: {
        PORT: 4000,
        NODE_ENV: "production",
        DOTENV_CONFIG_PATH: ".env.production"
      }
    },
    {
      name: "zorah-staging",
      script: "./src/app.js",
      cwd: "/home/ec2-user/Zorah",
      env: {
        PORT: 4001,
        NODE_ENV: "staging",
        DOTENV_CONFIG_PATH: ".env.staging"
      }
    }
  ]
};
```

---

## 3. Nginx Reverse Proxy Setup

Nginx acts as the primary web server and SSL termination layer. It routes external domain traffic to internal Node.js PM2 processes (`http://127.0.0.1:4000` and `http://127.0.0.1:4001`).

### Production & Staging Nginx Configuration (`/etc/nginx/conf.d/zorah.conf`)

```nginx
# Upstream definition for Production API
upstream zorah_production {
    server 127.0.0.1:4000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

# Upstream definition for Staging API
upstream zorah_staging {
    server 127.0.0.1:4001 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

# -------------------------------------------------------------
# Production Server Block (HTTP -> HTTPS Redirect)
# -------------------------------------------------------------
server {
    listen 80;
    listen [::]:80;
    server_name api.getzorah.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# Production HTTPS Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.getzorah.com;

    # SSL Certificate Configuration (Certbot / Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.getzorah.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.getzorah.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Maximum payload size for file uploads (e.g. KYC documents)
    client_max_body_size 15M;

    location / {
        proxy_pass http://zorah_production;
        proxy_http_version 1.1;

        # Header Proxying
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}

# -------------------------------------------------------------
# Staging Server Block
# -------------------------------------------------------------
server {
    listen 80;
    listen [::]:80;
    server_name staging-api.getzorah.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# Staging HTTPS Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name staging-api.getzorah.com;

    ssl_certificate /etc/letsencrypt/live/staging-api.getzorah.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging-api.getzorah.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 15M;

    location / {
        proxy_pass http://zorah_staging;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
    }
}
```

### Verifying and Reloading Nginx Configuration

```bash
# Test configuration syntax
sudo nginx -t

# Reload Nginx without downtime
sudo systemctl reload nginx
```

---

## 4. AWS Security Group Rules

The EC2 Security Group must be configured with explicit inbound traffic rules to permit management access and reverse proxy traffic.

### Required Inbound Port Configuration

| Port | Protocol | Source | Purpose | Security Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **22** | TCP | `ADMIN_IP/32` (or VPC CIDR) | Remote SSH administration | **Restrict** to authorized IP addresses. |
| **80** | TCP | `0.0.0.0/0`, `::/0` | HTTP traffic & SSL Certbot validation | Open to public. Auto-redirects to 443. |
| **443** | TCP | `0.0.0.0/0`, `::/0` | HTTPS secure web traffic | Open to public. |
| **4000** | TCP | `127.0.0.1` / Admin IP | Production API internal port | **Restrict** or keep internal only via Nginx. |
| **4001** | TCP | `127.0.0.1` / Admin IP | Staging API internal port | **Restrict** or keep internal only via Nginx. |

---

## 5. Manual Deployment & Operations Workflow

Follow this procedure for initial deployment and updates.

### 5.1 Initial Code Base Deployment

1. **SSH into the EC2 Instance**:
   ```bash
   ssh -i zorah-key.pem ec2-user@<YOUR_EC2_PUBLIC_IP>
   ```

2. **Navigate to Deployment Directory**:
   ```bash
   cd /home/ec2-user/Zorah
   ```

3. **Verify Environment Configurations**:
   Ensure `.env.production` and `.env.staging` exist and contain correct credentials.

4. **Install Dependencies**:
   ```bash
   npm install --omit=dev
   ```

5. **Start Process Manager**:
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

---

### 5.2 Standard Update & Deployment Procedure

To deploy fresh code changes with zero downtime:

```bash
# 1. Fetch latest changes from Git repository
git pull origin main

# 2. Update production dependencies
npm install --omit=dev

# 3. Perform zero-downtime reload for Production
pm2 reload zorah-backend

# 4. Perform zero-downtime reload for Staging
pm2 reload zorah-staging

# 5. Persist PM2 state across system reboots
pm2 save
```

---

### 5.3 Useful Operational Commands

- **Check Service Status**:
  ```bash
  pm2 status
  ```
- **Inspect Live Logs**:
  ```bash
  # View production logs
  pm2 logs zorah-backend --lines 100

  # View staging logs
  pm2 logs zorah-staging --lines 100
  ```
- **Restart Individual Services**:
  ```bash
  pm2 restart zorah-backend
  pm2 restart zorah-staging
  ```
- **Monitor System Resources**:
  ```bash
  pm2 monit
  ```
