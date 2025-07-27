#!/bin/bash

# Tailscale Auth Key Setup for Multi-Cloud Integration
# This script generates auth keys for cloud VM deployment

echo "🔐 Setting up Tailscale auth keys for multi-cloud integration..."

# Check if we're logged into Tailscale
if ! tailscale status >/dev/null 2>&1; then
    echo "❌ Tailscale not connected. Please run 'tailscale up' first."
    exit 1
fi

echo "✅ Tailscale connected - Current devices:"
tailscale status | head -5

echo ""
echo "📋 To create auth keys for cloud VMs:"
echo "1. Go to: https://login.tailscale.com/admin/settings/keys"
echo "2. Generate a reusable, ephemeral auth key"
echo "3. Copy the key (starts with 'tskey-auth-')"
echo ""
echo "🚀 For automated cloud VM deployment:"
echo ""
echo "AWS EC2 User Data:"
cat << 'EOF'
#!/bin/bash
yum update -y
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --authkey=YOUR_AUTH_KEY_HERE --hostname=aws-processor
EOF

echo ""
echo "GCP Compute Startup Script:"
cat << 'EOF'
#!/bin/bash
apt update && apt upgrade -y
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --authkey=YOUR_AUTH_KEY_HERE --hostname=gcp-processor
EOF

echo ""
echo "Oracle Cloud Init Script:"
cat << 'EOF'
#!/bin/bash
yum update -y
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --authkey=YOUR_AUTH_KEY_HERE --hostname=oracle-proxy
EOF

echo ""
echo "🔧 Next steps:"
echo "1. Create auth key from Tailscale admin panel"
echo "2. Replace YOUR_AUTH_KEY_HERE in the scripts above"
echo "3. Deploy cloud VMs with these scripts"
echo "4. Verify connectivity with: tailscale status"