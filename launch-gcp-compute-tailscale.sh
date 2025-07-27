#!/bin/bash

# Launch GCP f1-micro with Tailscale Integration
# Free tier optimized deployment

echo "🚀 Launching GCP f1-micro with Tailscale..."

# Configuration
INSTANCE_NAME="gcp-processor-tailscale"
MACHINE_TYPE="f1-micro"
ZONE="us-central1-a"
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"

# Create firewall rule for Tailscale if it doesn't exist
echo "🔒 Setting up firewall rules..."
gcloud compute firewall-rules describe tailscale-allow >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Creating Tailscale firewall rule..."
    gcloud compute firewall-rules create tailscale-allow \
        --allow udp:41641 \
        --source-ranges 0.0.0.0/0 \
        --description "Allow Tailscale UDP traffic" \
        --target-tags tailscale
else
    echo "Tailscale firewall rule already exists"
fi

# Startup script for Tailscale setup
STARTUP_SCRIPT=$(cat << 'EOF'
#!/bin/bash
apt update && apt upgrade -y
apt install -y curl wget git htop postgresql-client

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Create setup script for manual auth key entry
cat > /home/$(whoami)/setup-tailscale.sh << 'INNER_EOF'
#!/bin/bash
echo "🔐 To complete Tailscale setup:"
echo "1. Get auth key from: https://login.tailscale.com/admin/settings/keys"
echo "2. Run: sudo tailscale up --authkey=YOUR_KEY --hostname=gcp-processor"
echo "3. Verify: tailscale status"
INNER_EOF

chmod +x /home/$(whoami)/setup-tailscale.sh

# Install Google Cloud monitoring agent
curl -sSO https://dl.google.com/cloudagents/add-monitoring-agent-repo.sh
bash add-monitoring-agent-repo.sh --also-install

echo "GCP instance ready for Tailscale and Oracle mirroring" > /var/log/setup-complete.log
EOF
)

# Launch GCP instance
echo "🚁 Launching GCP Compute instance..."
gcloud compute instances create "$INSTANCE_NAME" \
    --machine-type="$MACHINE_TYPE" \
    --zone="$ZONE" \
    --image-family="$IMAGE_FAMILY" \
    --image-project="$IMAGE_PROJECT" \
    --boot-disk-size=10GB \
    --boot-disk-type=pd-standard \
    --tags=tailscale \
    --labels=purpose=oracle-mirror-processor \
    --metadata=startup-script="$STARTUP_SCRIPT"

if [ $? -eq 0 ]; then
    echo "✅ GCP instance launched successfully!"
    
    # Wait for instance to be running and get external IP
    echo "⏳ Waiting for instance to be ready..."
    sleep 30
    
    EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" \
        --zone="$ZONE" \
        --format="get(networkInterfaces[0].accessConfigs[0].natIP)")
    
    echo "🌐 External IP: $EXTERNAL_IP"
    echo ""
    echo "📋 Next steps:"
    echo "1. SSH into instance: gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
    echo "2. Run setup script: ./setup-tailscale.sh"
    echo "3. Get Tailscale auth key from: https://login.tailscale.com/admin/settings/keys"
    echo "4. Connect to Tailscale: sudo tailscale up --authkey=YOUR_KEY --hostname=gcp-processor"
    echo ""
    echo "🔗 Instance will appear as: gcp-processor.dory-phrygian.ts.net"
else
    echo "❌ Failed to launch GCP instance"
    exit 1
fi