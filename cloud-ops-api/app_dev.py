#!/usr/bin/env python3
"""
Simplified Cloud-Ops API for Development
Works without Oracle database connection
"""

from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime
from mock_data_service import mock_service
import requests
import os

app = Flask(__name__)
CORS(app)

# AWS Unified MCP URL
AWS_UNIFIED_URL = os.getenv('AWS_UNIFIED_URL', 'http://localhost:3000')

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    
    # Check AWS Unified MCP
    aws_unified_healthy = False
    try:
        resp = requests.get(f"{AWS_UNIFIED_URL}/health", timeout=2)
        aws_unified_healthy = resp.status_code == 200
    except:
        pass
    
    return jsonify({
        "status": "healthy",
        "mode": "development (no database)",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "aws_unified_mcp": aws_unified_healthy,
            "oracle": False,
            "notion": False
        }
    })

@app.route('/resources', methods=['GET'])
def get_resources():
    """Get cloud resources from mock service"""
    resources = mock_service.get_cloud_resources()
    
    return jsonify({
        "success": True,
        "count": len(resources),
        "resources": resources,
        "source": "mock_data",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/projects/analytics', methods=['GET'])
def get_project_analytics():
    """Get project analytics"""
    analytics = mock_service.get_project_analytics()
    
    return jsonify({
        "success": True,
        "analytics": analytics,
        "source": "mock_data",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/optimize/recommendations', methods=['GET'])
def get_optimization_recommendations():
    """Get optimization recommendations"""
    recommendations = mock_service.get_optimization_recommendations()
    
    return jsonify({
        "success": True,
        "count": len(recommendations),
        "recommendations": recommendations,
        "total_potential_savings": sum(r['potential_savings'] for r in recommendations),
        "source": "mock_data",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/aws-unified/query', methods=['POST'])
def query_aws_unified():
    """Proxy queries to AWS Unified MCP"""
    try:
        # Forward to AWS Unified MCP
        # In real implementation, this would use the MCP protocol
        return jsonify({
            "success": True,
            "message": "AWS Unified MCP integration ready",
            "url": AWS_UNIFIED_URL
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    print("🚀 Starting Cloud-Ops Development API")
    print("📍 API: http://localhost:5001")
    print("📊 Mode: Development (using mock data)")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5001, debug=True)
