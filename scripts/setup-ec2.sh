#!/usr/bin/env bash
# ==============================================================================
# RepoHawk EC2 One-Click Provisioning Script (Ubuntu 22.04 / 24.04 LTS)
# Run on the EC2 instance:
#   chmod +x scripts/setup-ec2.sh && ./scripts/setup-ec2.sh
# ==============================================================================
set -e

echo "🚀 [1/5] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw jq

# ── 2GB SWAP (Crucial for t3.small instances to prevent OOM during builds) ──────
if [ ! -f /swapfile ]; then
    echo "💾 [2/5] Setting up 2GB swap space (prevents out-of-memory during builds)..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap configured."
else
    echo "💾 [2/5] Swap already configured."
fi

# ── Install Docker & Docker Compose ───────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "🐳 [3/5] Installing Docker engine..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Allow current user to run docker without sudo
    sudo usermod -aG docker "$USER"
    echo "✅ Docker installed."
else
    echo "🐳 [3/5] Docker is already installed."
fi

# ── Configure Basic Firewall (UFW) ────────────────────────────────────────────
echo "🛡️  [4/5] Configuring firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Next.js
sudo ufw allow 8000/tcp  # FastAPI
sudo ufw --force enable

echo "✨ [5/5] EC2 Host is prepared!"
echo "--------------------------------------------------"
echo "To start RepoHawk in production via Docker Compose:"
echo "  1. Copy your backend/.env"
echo "  2. Run: sudo docker compose -f docker-compose.prod.yml up -d --build"
echo "  3. Check logs: sudo docker compose -f docker-compose.prod.yml logs -f"
echo "--------------------------------------------------"
