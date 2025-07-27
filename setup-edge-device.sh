#!/bin/bash
# Setup script for edge devices - run this on each Pi

echo "🔧 Setting up edge device for AWS sync..."

# Create AWS credentials directory
mkdir -p ~/.aws

# Create credentials file (you'll need to add your actual credentials)
cat > ~/.aws/credentials << 'EOF'
[default]
aws_access_key_id = YOUR_ACCESS_KEY_ID
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY
EOF

cat > ~/.aws/config << 'EOF'
[default]
region = us-east-1
output = json
EOF

echo "⚠️  IMPORTANT: Edit ~/.aws/credentials and add your AWS credentials"

# Install AWS CLI if not present
if ! command -v aws &> /dev/null; then
    echo "📦 Installing AWS CLI..."
    curl -s "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    sudo ./aws/install
    rm -rf awscliv2.zip aws/
fi

# Set up cron jobs for automated sync
echo "⏰ Setting up cron jobs..."
(crontab -l 2>/dev/null || true; echo "0 * * * * /home/sam/edge-sync-free-tier.sh hourly") | crontab -
(crontab -l 2>/dev/null || true; echo "0 2 * * * /home/sam/edge-sync-free-tier.sh daily") | crontab -

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit ~/.aws/credentials with your AWS access keys"
echo "2. Test with: ./edge-sync-free-tier.sh hourly"
echo "3. View logs: tail -f /var/log/syslog | grep edge-sync"