#!/bin/bash
# RepoHawk Droplet Setup Script
# Run this on a fresh Ubuntu 24.04 Droplet as root.

set -e

echo "========================================="
echo "🦅 RepoHawk VPS Droplet Setup"
echo "========================================="

# 1. Update and install prerequisites
echo ">> Updating system..."
apt-get update && apt-get upgrade -y
apt-get install -y git curl wget jq ufw

# 2. Install Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo ">> Installing Docker..."
    curl -fsSL https://get.docker.com | sh
else
    echo ">> Docker already installed."
fi

# 3. Install Caddy (for automatic HTTPS)
if ! command -v caddy &> /dev/null; then
    echo ">> Installing Caddy..."
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
else
    echo ">> Caddy already installed."
fi

# 4. Clone RepoHawk Repository
REPO_DIR="/opt/RepoHawk"
if [ ! -d "$REPO_DIR" ]; then
    echo ">> Cloning RepoHawk repository to $REPO_DIR..."
    git clone https://github.com/AKSHAYRAM2003/RepoHawk.git $REPO_DIR
else
    echo ">> Repository already exists at $REPO_DIR. Pulling latest..."
    cd $REPO_DIR && git pull origin main
fi

# 5. Setup Firewall (UFW)
echo ">> Configuring Firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 6. Configure Caddy Reverse Proxy
echo ">> Configuring Caddy for api.repohawk.app..."
cat > /etc/caddy/Caddyfile << 'EOF'
api.repohawk.app {
    reverse_proxy localhost:8000
}
EOF
systemctl restart caddy

# 7. Setup Environment Variables File
ENV_FILE="$REPO_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo ">> Creating baseline .env file..."
    cp "$REPO_DIR/backend/.env.example" "$ENV_FILE"
    
    # Auto-generate a JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=\"$JWT_SECRET\"/" "$ENV_FILE"
    
    # Set default database URL for the docker-compose postgres container
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://repohawk_user:repohawk_password@postgres:5432/repohawk_db\"|" "$ENV_FILE"
    
    # Set Frontend URL
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=\"https://repohawk.app\"|" "$ENV_FILE"
fi

echo "========================================="
echo "✅ Base setup complete!"
echo ""
echo "🔥 NEXT STEPS (Required before starting):"
echo "1. Edit the secrets in the .env file:"
echo "   nano $REPO_DIR/backend/.env"
echo "   (Make sure to add your OPENROUTER_API_KEY!)"
echo ""
echo "2. Make sure you mapped the 'api.repohawk.app' DNS A-record to this Droplet's IP."
echo ""
echo "3. Start the containers:"
echo "   cd $REPO_DIR"
echo "   docker compose up -d"
echo "========================================="
