#!/usr/bin/env bash
# ==============================================================================
# Zorah Backend - EC2 Bootstrap & Infrastructure Provisioning Script
# ==============================================================================
# Target OS: Amazon Linux 2023 / Amazon Linux 2 / Ubuntu 22.04 LTS / Debian 12
# Purpose:   Automate installation of Node.js 20 LTS, PM2, Nginx, and directory setup
# Usage:     sudo ./scripts/setup-ec2.sh
# ==============================================================================

set -euo pipefail

# ANSI Color Codes for Pretty Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Ensure script is executed with root/sudo privileges
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root or using sudo."
   exit 1
fi

log_info "Starting Zorah EC2 Server Setup..."

# ------------------------------------------------------------------------------
# 1. Package Manager Detection & System Updates
# ------------------------------------------------------------------------------
log_info "Updating system packages..."

if command -v dnf &> /dev/null; then
    PKG_MGR="dnf"
    dnf update -y
    dnf install -y curl git tar unzip wget gzip
elif command -v yum &> /dev/null; then
    PKG_MGR="yum"
    yum update -y
    yum install -y curl git tar unzip wget gzip
elif command -v apt-get &> /dev/null; then
    PKG_MGR="apt"
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y curl git tar unzip wget gzip build-essential
else
    log_error "Unsupported package manager. Please use Amazon Linux 2023/2, RHEL, or Ubuntu/Debian."
    exit 1
fi

log_success "System package update complete."

# ------------------------------------------------------------------------------
# 2. Node.js 20 LTS Installation
# ------------------------------------------------------------------------------
log_info "Installing Node.js 20 LTS..."

if command -v node &> /dev/null; then
    CURRENT_NODE_VER=$(node -v)
    log_info "Node.js is already installed ($CURRENT_NODE_VER)."
else
    if [[ "$PKG_MGR" == "apt" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif [[ "$PKG_MGR" == "dnf" || "$PKG_MGR" == "yum" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        $PKG_MGR install -y nodejs
    fi
fi

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
log_success "Node.js $NODE_VERSION and npm $NPM_VERSION installed successfully."

# ------------------------------------------------------------------------------
# 3. PM2 Global Installation & Startup Setup
# ------------------------------------------------------------------------------
log_info "Installing PM2 (Process Manager 2) globally..."
npm install -g pm2@latest

log_info "Configuring PM2 startup service hook..."
# Enable PM2 to restart applications on system reboot
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ${SUDO_USER:-ec2-user} --hp /home/${SUDO_USER:-ec2-user} || true
log_success "PM2 installed and startup hook configured."

# ------------------------------------------------------------------------------
# 4. Nginx Installation & Enablement
# ------------------------------------------------------------------------------
log_info "Installing and configuring Nginx..."

if [[ "$PKG_MGR" == "apt" ]]; then
    apt-get install -y nginx
elif [[ "$PKG_MGR" == "dnf" ]]; then
    dnf install -y nginx
elif [[ "$PKG_MGR" == "yum" ]]; then
    amazon-linux-extras install nginx1 -y 2>/dev/null || yum install -y nginx
fi

log_info "Enabling and starting Nginx service..."
systemctl enable nginx
systemctl start nginx

if systemctl is-active --quiet nginx; then
    log_success "Nginx service is running and enabled on boot."
else
    log_warn "Nginx service installed but failed to auto-start. Check 'systemctl status nginx'."
fi

# ------------------------------------------------------------------------------
# 5. Deployment Directory Setup
# ------------------------------------------------------------------------------
log_info "Setting up deployment directory structure..."

DEPLOY_USER="${SUDO_USER:-ec2-user}"

# Check if deploy user exists, fallback to current user
if ! id "$DEPLOY_USER" &>/dev/null; then
    DEPLOY_USER=$(whoami)
fi

DEPLOY_GROUP=$(id -gn "$DEPLOY_USER")

# Directory paths
PRIMARY_DIR="/var/www/zorah"
HOME_DIR="/home/$DEPLOY_USER/Zorah"

mkdir -p "$PRIMARY_DIR"

if [[ -d "/home/$DEPLOY_USER" ]]; then
    mkdir -p "$HOME_DIR"
    chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$HOME_DIR"
    chmod 755 "$HOME_DIR"
    log_info "Created home deployment directory: $HOME_DIR"
fi

chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$PRIMARY_DIR"
chmod 755 "$PRIMARY_DIR"
log_success "Created primary deployment directory: $PRIMARY_DIR"

# ------------------------------------------------------------------------------
# 6. Completion Summary
# ------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}======================================================================${NC}"
echo -e "${GREEN}  ZORAH EC2 BOOTSTRAP COMPLETE ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo " Installed Components:"
echo "   - Node.js: $(node -v)"
echo "   - npm:     $(npm -v)"
echo "   - PM2:     $(pm2 -v)"
echo "   - Nginx:   $(nginx -v 2>&1)"
echo ""
echo " Deployment Directories:"
echo "   - /var/www/zorah (Owned by $DEPLOY_USER)"
if [[ -d "$HOME_DIR" ]]; then
    echo "   - $HOME_DIR (Owned by $DEPLOY_USER)"
fi
echo ""
echo " Next Steps:"
echo "   1. Clone repository into deployment directory"
echo "   2. Copy .env.example to .env.production and .env.staging"
echo "   3. Place Nginx config into /etc/nginx/conf.d/zorah.conf"
echo "   4. Run 'pm2 start ecosystem.config.cjs && pm2 save'"
echo -e "${GREEN}======================================================================${NC}"
