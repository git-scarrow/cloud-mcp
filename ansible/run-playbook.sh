#!/bin/bash

# Ansible playbook runner for edge cluster management

set -e

PLAYBOOK_DIR="/Users/sam/dev/aws/ansible/playbooks"
ANSIBLE_DIR="/Users/sam/dev/aws/ansible"

cd "$ANSIBLE_DIR"

case "$1" in
    "info"|"status")
        echo "🔍 Gathering system information from all edge devices..."
        ansible-playbook "$PLAYBOOK_DIR/system-info.yml"
        ;;
    "k3s")
        echo "☸️  Checking k3s cluster status..."
        ansible-playbook "$PLAYBOOK_DIR/k3s-status.yml"
        ;;
    "sync")
        echo "🔄 Checking edge sync status..."
        ansible-playbook "$PLAYBOOK_DIR/edge-sync.yml"
        ;;
    "deploy")
        echo "🚀 Deploying edge-cloud architecture..."
        ansible-playbook "$PLAYBOOK_DIR/deploy-edge-cloud.yml"
        ;;
    "ping")
        echo "🏓 Testing connectivity to all devices..."
        ansible all -m ping
        ;;
    "facts")
        echo "📊 Gathering detailed facts from all devices..."
        ansible all -m setup
        ;;
    *)
        echo "Usage: $0 {info|k3s|sync|deploy|ping|facts}"
        echo ""
        echo "Available commands:"
        echo "  info   - Get system information from all devices"
        echo "  k3s    - Check k3s cluster status"
        echo "  sync   - Check edge sync operations"
        echo "  deploy - Deploy edge-cloud architecture"
        echo "  ping   - Test basic connectivity"
        echo "  facts  - Gather detailed system facts"
        exit 1
        ;;
esac