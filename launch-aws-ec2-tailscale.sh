#!/bin/bash

# Launch AWS EC2 t2.micro with Tailscale Integration
# Free tier optimized deployment

echo "🚀 Launching AWS EC2 t2.micro with Tailscale..."

# Configuration
INSTANCE_TYPE="t2.micro"
AMI_ID="ami-0c02fb55956c7d316"  # Amazon Linux 2 AMI (HVM) - Kernel 5.10, SSD Volume Type
KEY_NAME="your-key-pair"  # Replace with your key pair name
SECURITY_GROUP="tailscale-sg"

# Create security group if it doesn't exist
echo "🔒 Setting up security group..."
aws ec2 describe-security-groups --group-names "$SECURITY_GROUP" >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Creating security group: $SECURITY_GROUP"
    aws ec2 create-security-group \
        --group-name "$SECURITY_GROUP" \
        --description "Security group for Tailscale-enabled EC2 instances"
    
    # Allow SSH access
    aws ec2 authorize-security-group-ingress \
        --group-name "$SECURITY_GROUP" \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0
    
    # Allow Tailscale UDP (41641)
    aws ec2 authorize-security-group-ingress \
        --group-name "$SECURITY_GROUP" \
        --protocol udp \
        --port 41641 \
        --cidr 0.0.0.0/0
else
    echo "Security group $SECURITY_GROUP already exists"
fi

# User data script for Tailscale setup
USER_DATA=$(cat << 'EOF'
#!/bin/bash
yum update -y
yum install -y curl wget git htop

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Note: Auth key will need to be added manually or via parameter
echo "Tailscale installed. Run: sudo tailscale up --authkey=YOUR_KEY --hostname=aws-processor"

# Install monitoring tools
yum install -y cloudwatch-agent

# Create startup script
cat > /home/ec2-user/setup-tailscale.sh << 'INNER_EOF'
#!/bin/bash
echo "🔐 To complete Tailscale setup:"
echo "1. Get auth key from: https://login.tailscale.com/admin/settings/keys"
echo "2. Run: sudo tailscale up --authkey=YOUR_KEY --hostname=aws-processor"
echo "3. Verify: tailscale status"
INNER_EOF

chmod +x /home/ec2-user/setup-tailscale.sh

# Set up Oracle mirror connection tools
yum install -y postgresql-client

echo "AWS EC2 instance ready for Tailscale and Oracle mirroring" > /var/log/setup-complete.log
EOF
)

# Launch EC2 instance
echo "🚁 Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --count 1 \
    --instance-type "$INSTANCE_TYPE" \
    --security-groups "$SECURITY_GROUP" \
    --user-data "$USER_DATA" \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=aws-processor-tailscale},{Key=Purpose,Value=Oracle-Mirror-Processor}]' \
    --query 'Instances[0].InstanceId' \
    --output text)

if [ $? -eq 0 ]; then
    echo "✅ EC2 instance launched successfully!"
    echo "Instance ID: $INSTANCE_ID"
    
    # Wait for instance to be running
    echo "⏳ Waiting for instance to be running..."
    aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
    
    # Get public IP
    PUBLIC_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)
    
    echo "🌐 Public IP: $PUBLIC_IP"
    echo ""
    echo "📋 Next steps:"
    echo "1. SSH into instance: ssh -i ~/.ssh/your-key.pem ec2-user@$PUBLIC_IP"
    echo "2. Run setup script: ./setup-tailscale.sh"
    echo "3. Get Tailscale auth key from: https://login.tailscale.com/admin/settings/keys"
    echo "4. Connect to Tailscale: sudo tailscale up --authkey=YOUR_KEY --hostname=aws-processor"
    echo ""
    echo "🔗 Instance will appear as: aws-processor.dory-phrygian.ts.net"
else
    echo "❌ Failed to launch EC2 instance"
    exit 1
fi