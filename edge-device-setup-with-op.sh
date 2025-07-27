#!/bin/bash
# Setup edge device with 1Password integration

echo "🔐 Setting up edge device with 1Password AWS credentials..."

# Check if op is installed
if ! command -v op &> /dev/null; then
    echo "📦 Installing 1Password CLI..."
    if [[ $(uname -m) == "aarch64" ]]; then
        # ARM64 version for Raspberry Pi
        curl -sSfo op.zip https://cache.agilebits.com/dist/1P/op2/pkg/v2.31.1/op_linux_arm64_v2.31.1.zip
    else
        curl -sSfo op.zip https://cache.agilebits.com/dist/1P/op2/pkg/v2.31.1/op_linux_amd64_v2.31.1.zip
    fi
    unzip -q op.zip
    sudo mv op /usr/local/bin/
    rm op.zip
fi

# Create AWS credentials fetcher script
cat > ~/fetch-aws-credentials.sh << 'EOF'
#!/bin/bash
# Fetch AWS credentials from 1Password

# Sign in to 1Password (if not already)
if ! op account list &>/dev/null; then
    echo "Please sign in to 1Password:"
    eval $(op signin)
fi

# Fetch AWS credentials from 1Password
# Using the existing "AWS Access Key" item
AWS_ACCESS_KEY_ID=$(op item get "AWS Access Key" --fields "access key id" 2>/dev/null)
AWS_SECRET_ACCESS_KEY=$(op item get "AWS Access Key" --fields "secret access key" 2>/dev/null)

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "❌ Failed to fetch AWS credentials from 1Password"
    echo "Make sure you have an item named 'AWS Access Key' with fields:"
    echo "  - access key id"
    echo "  - secret access key"
    exit 1
fi

# Export for current session
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION=us-east-1

echo "✅ AWS credentials loaded from 1Password"
EOF

chmod +x ~/fetch-aws-credentials.sh

# Create wrapper for edge sync that uses 1Password
cat > ~/edge-sync-secure.sh << 'EOF'
#!/bin/bash
# Secure edge sync using 1Password credentials

# Source AWS credentials from 1Password
source ~/fetch-aws-credentials.sh

# Run the edge sync
/home/sam/edge-sync-free-tier.sh "$@"
EOF

chmod +x ~/edge-sync-secure.sh

# Create systemd service for edge sync (optional)
sudo tee /etc/systemd/system/edge-sync.service << EOF
[Unit]
Description=Edge to Cloud Sync Service
After=network.target

[Service]
Type=oneshot
User=sam
ExecStart=/home/sam/edge-sync-secure.sh hourly
Environment="PATH=/usr/local/bin:/usr/bin:/bin"

[Install]
WantedBy=multi-user.target
EOF

# Create systemd timer
sudo tee /etc/systemd/system/edge-sync.timer << EOF
[Unit]
Description=Run edge sync hourly
Requires=edge-sync.service

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Your 1Password 'AWS Access Key' item will be used automatically"
echo ""
echo "2. Test with: ./edge-sync-secure.sh hourly"
echo ""
echo "3. Enable automatic sync:"
echo "   sudo systemctl enable --now edge-sync.timer"
echo ""
echo "4. For EC2 instances, use IAM instance profile instead:"
echo "   Instance Profile: edge-device-profile"