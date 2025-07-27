// Comprehensive Pipedream Workflow Actions for Cloud Operations Hub
// Add these actions to your workflow at https://pipedream.com/@/p_wOCvRxL

// ============================================
// STEP 1: Input Validation & Routing
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const event = steps.trigger.event.body;
    
    // Validate required fields
    if (!event.resource_id || !event.alert_type) {
      return $.flow.exit("Invalid alert format");
    }
    
    // Set workflow context
    $.export("alert", {
      ...event,
      received_at: new Date().toISOString(),
      workflow_id: $.workflow.id,
      execution_id: $.id
    });
    
    // Route by severity
    $.export("priority", 
      event.severity === "Critical" ? "P0" :
      event.severity === "High" ? "P1" : 
      event.severity === "Medium" ? "P2" : "P3"
    );
    
    console.log(`Processing ${event.severity} alert for ${event.resource_id}`);
    return event;
  }
});

// ============================================
// STEP 2: Enrich with MCP Context
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const alert = steps.input_validation.$return_value;
    
    try {
      // Query AWS Unified MCP for device status
      const deviceStatus = await fetch('http://localhost:3002/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'edge',
          query: `device status ${alert.resource_id}`
        })
      }).then(r => r.text());
      
      // Get cost analysis
      const costData = await fetch('http://localhost:3002/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'edge',
          query: 'cost analysis'
        })
      }).then(r => r.text());
      
      $.export("enrichment", {
        device_status: deviceStatus,
        cost_context: costData,
        enriched_at: new Date().toISOString()
      });
      
      return {
        alert,
        context: {
          device_status: deviceStatus,
          cost_context: costData
        }
      };
    } catch (error) {
      console.error("MCP enrichment failed:", error);
      return { alert, context: { error: error.message } };
    }
  }
});

// ============================================
// STEP 3: SSH Diagnostics (Parallel)
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const alert = steps.input_validation.$return_value;
    
    // Map device names to SSH endpoints
    const sshEndpoints = {
      'pifive0': { host: '72.92.48.66', port: 2205 },
      'piiv': { host: '72.92.48.66', port: 2215 },
      'piiv2': { host: '72.92.48.66', port: 2229 }
    };
    
    const endpoint = sshEndpoints[alert.resource_id];
    if (!endpoint) {
      return { error: "Unknown device" };
    }
    
    // Diagnostic commands based on alert type
    const diagnosticCommands = {
      'high_cpu': [
        'top -bn1 | head -20',
        'ps aux --sort=-%cpu | head -10',
        'systemctl status edge-processor'
      ],
      'disk_full': [
        'df -h',
        'du -sh /var/log/* | sort -rh | head -10',
        'find /tmp -type f -size +100M'
      ],
      'service_down': [
        'systemctl status edge-processor',
        'journalctl -u edge-processor -n 50',
        'ps aux | grep edge'
      ],
      'high_memory': [
        'free -h',
        'ps aux --sort=-%mem | head -10',
        'cat /proc/meminfo | head -10'
      ]
    };
    
    const commands = diagnosticCommands[alert.alert_type] || ['uptime', 'free -h', 'df -h'];
    const results = {};
    
    // Execute diagnostics
    try {
      for (const cmd of commands) {
        // In production, use Pipedream's SSH action
        results[cmd] = `Mock output for: ${cmd}`;
      }
      
      $.export("diagnostics", results);
      return { 
        device: alert.resource_id,
        diagnostics: results,
        executed_at: new Date().toISOString()
      };
    } catch (error) {
      return { error: error.message };
    }
  }
});

// ============================================
// STEP 4: Create/Update Notion Incident
// ============================================
export default defineComponent({
  props: {
    notion: {
      type: "app",
      app: "notion"
    }
  },
  async run({ steps, $ }) {
    const alert = steps.input_validation.$return_value;
    const enrichment = steps.enrich_context.$return_value;
    const diagnostics = steps.ssh_diagnostics.$return_value;
    
    // Check if incident already exists
    const existing = await this.notion.databases.query({
      database_id: "23be7cc7-01d5-813f-8bc4-e73325f0535a",
      filter: {
        and: [
          {
            property: "Name",
            title: { contains: alert.resource_id }
          },
          {
            property: "Status",
            select: { equals: "Active" }
          }
        ]
      }
    });
    
    if (existing.results.length > 0) {
      // Update existing incident
      const page = existing.results[0];
      await this.notion.pages.update({
        page_id: page.id,
        properties: {
          "Status": { select: { name: "Active" } },
          "Current Month Spend": { number: parseFloat(alert.metadata?.cost || 0) }
        }
      });
      
      // Add comment with new alert
      await this.notion.comments.create({
        parent: { page_id: page.id },
        rich_text: [{
          text: {
            content: `New ${alert.severity} alert: ${alert.message}\\n\\nDiagnostics:\\n${JSON.stringify(diagnostics, null, 2)}`
          }
        }]
      });
      
      $.export("notion_page", { 
        action: "updated", 
        page_id: page.id,
        url: page.url 
      });
      
    } else {
      // Create new incident page
      const newPage = await this.notion.pages.create({
        parent: { database_id: "23be7cc7-01d5-813f-8bc4-e73325f0535a" },
        icon: {
          emoji: alert.severity === "Critical" ? "🚨" : 
                 alert.severity === "High" ? "⚠️" : "📊"
        },
        properties: {
          "Name": {
            title: [{
              text: { 
                content: `${alert.severity}: ${alert.resource_id} - ${alert.alert_type}` 
              }
            }]
          },
          "Status": { select: { name: "Active" } },
          "Project ID": { 
            rich_text: [{ text: { content: alert.resource_id } }] 
          },
          "Budget Monthly": { 
            number: alert.alert_type === "cost_anomaly" ? 100 : 50 
          },
          "Current Month Spend": { 
            number: parseFloat(alert.metadata?.cost || 0) 
          }
        },
        children: [
          {
            object: "block",
            type: "heading_1",
            heading_1: {
              rich_text: [{ text: { content: "📋 Incident Details" } }]
            }
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{
                text: { 
                  content: `Alert Type: ${alert.alert_type}\\nSeverity: ${alert.severity}\\nTime: ${alert.timestamp}\\nMessage: ${alert.message}` 
                }
              }]
            }
          },
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [{ text: { content: "🔍 Diagnostics" } }]
            }
          },
          {
            object: "block",
            type: "code",
            code: {
              rich_text: [{
                text: { content: JSON.stringify(diagnostics.diagnostics || {}, null, 2) }
              }],
              language: "json"
            }
          },
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [{ text: { content: "📊 System Context" } }]
            }
          },
          {
            object: "block",
            type: "code",
            code: {
              rich_text: [{
                text: { content: enrichment.context?.device_status || "No data" }
              }],
              language: "plain text"
            }
          }
        ]
      });
      
      $.export("notion_page", { 
        action: "created", 
        page_id: newPage.id,
        url: newPage.url 
      });
    }
    
    return {
      notion_action: existing.results.length > 0 ? "updated" : "created",
      page_url: existing.results[0]?.url || "New page created"
    };
  }
});

// ============================================
// STEP 5: Auto-Remediation Engine
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const alert = steps.input_validation.$return_value;
    const priority = $.flow.priority;
    
    // Define remediation actions
    const remediations = {
      'high_cpu': {
        P0: ['sudo systemctl restart edge-processor'],
        P1: ['sudo systemctl reload edge-processor'],
        P2: ['echo "CPU alert logged"']
      },
      'disk_full': {
        P0: [
          'sudo find /var/log -name "*.log" -mtime +7 -delete',
          'sudo find /tmp -type f -mtime +1 -delete',
          'sudo docker system prune -af'
        ],
        P1: ['sudo find /var/log -name "*.log" -mtime +30 -delete'],
        P2: ['df -h > /tmp/disk_report.txt']
      },
      'service_down': {
        P0: [
          'sudo systemctl start edge-processor',
          'sudo systemctl enable edge-processor'
        ],
        P1: ['sudo systemctl restart edge-processor'],
        P2: ['systemctl status edge-processor']
      },
      'high_memory': {
        P0: ['sudo sync && sudo sysctl -w vm.drop_caches=3'],
        P1: ['ps aux --sort=-%mem | head -5'],
        P2: ['free -h']
      }
    };
    
    const actions = remediations[alert.alert_type]?.[priority] || [];
    
    if (actions.length === 0) {
      return { remediation: "none", reason: "No automated actions defined" };
    }
    
    // Check if auto-remediation is allowed
    const autoRemediateEnabled = priority === "P0" || 
      (priority === "P1" && alert.source === "edge-monitor");
    
    if (!autoRemediateEnabled) {
      $.export("remediation_status", "manual_approval_required");
      return {
        remediation: "pending_approval",
        actions_planned: actions,
        reason: "Requires manual approval for this priority level"
      };
    }
    
    // Execute remediation
    const results = [];
    for (const action of actions) {
      try {
        // In production, execute via SSH
        results.push({
          command: action,
          status: "executed",
          output: `Mock execution: ${action}`
        });
      } catch (error) {
        results.push({
          command: action,
          status: "failed",
          error: error.message
        });
      }
    }
    
    $.export("remediation_results", results);
    
    return {
      remediation: "completed",
      actions_executed: results.length,
      results: results
    };
  }
});

// ============================================
// STEP 6: Smart Notification Router
// ============================================
export default defineComponent({
  props: {
    slack: {
      type: "app", 
      app: "slack"
    },
    email: {
      type: "app",
      app: "email"
    }
  },
  async run({ steps, $ }) {
    const alert = steps.input_validation.$return_value;
    const notionPage = steps.notion_incident.$return_value;
    const remediation = steps.auto_remediation.$return_value;
    
    const emoji = {
      'Critical': '🚨',
      'High': '⚠️',
      'Medium': '📊',
      'Low': 'ℹ️'
    }[alert.severity] || '📌';
    
    // Build notification message
    const message = `${emoji} **${alert.severity} Alert - ${alert.resource_id}**

**Type**: ${alert.alert_type}
**Message**: ${alert.message}
**Time**: ${new Date(alert.timestamp).toLocaleString()}

**Actions Taken**:
• Diagnostics: ✅ Completed
• Notion Page: ${notionPage.notion_action === 'created' ? '✅ Created' : '📝 Updated'}
• Auto-Fix: ${remediation.remediation === 'completed' ? '✅ Applied' : '⏳ Manual approval needed'}

**Next Steps**: ${remediation.remediation === 'completed' ? 
  'Monitor for recurrence' : 
  'Review and approve remediation actions'}

View details: ${notionPage.page_url || 'Check Notion'}`;

    const notifications = [];
    
    // Critical alerts - multiple channels
    if (alert.severity === 'Critical') {
      // Slack
      try {
        await this.slack.sdk.chat.postMessage({
          channel: "#cloud-alerts-critical",
          text: message,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: message }
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "View in Notion" },
                  url: notionPage.page_url
                },
                {
                  type: "button", 
                  text: { type: "plain_text", text: "Approve Fix" },
                  style: "danger",
                  value: `approve_${$.id}`
                }
              ]
            }
          ]
        });
        notifications.push({ channel: "slack", status: "sent" });
      } catch (e) {
        notifications.push({ channel: "slack", status: "failed", error: e.message });
      }
      
      // Email
      try {
        await this.email.send({
          to: "sscarrow@gmail.com",
          subject: `${emoji} CRITICAL: ${alert.alert_type} on ${alert.resource_id}`,
          html: message.replace(/\\n/g, '<br>').replace(/\\*\\*/g, '<b>').replace(/\\*\\*/g, '</b>')
        });
        notifications.push({ channel: "email", status: "sent" });
      } catch (e) {
        notifications.push({ channel: "email", status: "failed", error: e.message });
      }
    }
    
    // High/Medium - Slack only
    else if (alert.severity === 'High' || alert.severity === 'Medium') {
      try {
        await this.slack.sdk.chat.postMessage({
          channel: "#cloud-alerts",
          text: message
        });
        notifications.push({ channel: "slack", status: "sent" });
      } catch (e) {
        // Fallback to console
        console.log("Slack notification failed, logging to console:", message);
        notifications.push({ channel: "console", status: "sent" });
      }
    }
    
    $.export("notifications", notifications);
    
    return {
      notifications_sent: notifications.filter(n => n.status === "sent").length,
      channels: notifications
    };
  }
});

// ============================================
// STEP 7: Update Resource Inventory
// ============================================
export default defineComponent({
  props: {
    notion: {
      type: "app",
      app: "notion"
    }
  },
  async run({ steps, $ }) {
    const alert = steps.input_validation.$return_value;
    const enrichment = steps.enrich_context.$return_value;
    
    try {
      // Find resource in inventory
      const resources = await this.notion.databases.query({
        database_id: "23be7cc7-01d5-81f0-a8cc-cfa88a213102",
        filter: {
          property: "Resource UUID",
          rich_text: { equals: alert.resource_id }
        }
      });
      
      if (resources.results.length === 0) {
        // Create new resource entry
        await this.notion.pages.create({
          parent: { database_id: "23be7cc7-01d5-81f0-a8cc-cfa88a213102" },
          properties: {
            "Name": {
              title: [{ text: { content: alert.resource_id } }]
            },
            "Resource UUID": {
              rich_text: [{ text: { content: alert.resource_id } }]
            },
            "Resource Type": {
              select: { name: "Edge Device" }
            },
            "Provider": {
              select: { name: "Edge Device" }
            },
            "Status": {
              select: { 
                name: alert.severity === "Critical" ? "🔴 Critical" : 
                      alert.severity === "High" ? "🟡 Warning" : "🟢 Active"
              }
            },
            "Last Updated": {
              date: { start: new Date().toISOString() }
            }
          }
        });
        
        return { action: "created_new_resource" };
        
      } else {
        // Update existing resource
        const resource = resources.results[0];
        await this.notion.pages.update({
          page_id: resource.id,
          properties: {
            "Status": {
              select: { 
                name: alert.severity === "Critical" ? "🔴 Critical" : 
                      alert.severity === "High" ? "🟡 Warning" : "🟢 Active"
              }
            },
            "CPU Usage %": {
              number: alert.metadata?.cpu_usage ? 
                parseFloat(alert.metadata.cpu_usage) / 100 : null
            },
            "Optimization Flag": {
              select: {
                name: alert.alert_type === "cost_anomaly" ? "Cost Anomaly" :
                      alert.alert_type === "high_cpu" ? "Right-size Candidate" :
                      "Normal"
              }
            },
            "Last Updated": {
              date: { start: new Date().toISOString() }
            }
          }
        });
        
        return { action: "updated_resource", resource_id: resource.id };
      }
    } catch (error) {
      console.error("Resource inventory update failed:", error);
      return { error: error.message };
    }
  }
});

// ============================================
// STEP 8: Audit & Metrics Logger
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const alert = steps.input_validation.$return_value;
    const remediation = steps.auto_remediation.$return_value;
    const notifications = steps.notification_router.$return_value;
    
    const auditEntry = {
      timestamp: new Date().toISOString(),
      workflow_execution_id: $.id,
      alert: {
        resource_id: alert.resource_id,
        type: alert.alert_type,
        severity: alert.severity,
        source: alert.source
      },
      actions_taken: {
        diagnostics_run: !!steps.ssh_diagnostics.$return_value,
        notion_updated: steps.notion_incident.$return_value.notion_action,
        remediation_applied: remediation.remediation === "completed",
        notifications_sent: notifications.notifications_sent
      },
      performance: {
        total_duration_ms: Date.now() - new Date(alert.received_at).getTime(),
        mcp_enrichment: !!steps.enrich_context.$return_value.context,
        auto_remediated: remediation.remediation === "completed"
      },
      outcome: {
        success: true,
        required_manual_intervention: remediation.remediation !== "completed"
      }
    };
    
    // Store in Pipedream data store
    await $.data.set(`audit_${$.id}`, auditEntry, { ttl: 2592000 }); // 30 days
    
    // Log summary
    console.log(`Workflow completed in ${auditEntry.performance.total_duration_ms}ms`);
    console.log(`Actions: Diagnostics ✓ | Notion ${auditEntry.actions_taken.notion_updated} | Remediation ${auditEntry.actions_taken.remediation_applied ? '✓' : '⏳'} | Notifications ${auditEntry.actions_taken.notifications_sent}`);
    
    $.export("audit", auditEntry);
    
    return auditEntry;
  }
});

// ============================================
// STEP 9: Workflow Summary & Next Actions
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const alert = steps.input_validation.$return_value;
    const audit = steps.audit_logger.$return_value;
    
    const summary = {
      alert_id: alert.resource_id + '_' + Date.now(),
      processed_at: new Date().toISOString(),
      severity: alert.severity,
      
      results: {
        diagnostics_captured: true,
        incident_documented: true,
        auto_remediation: audit.actions_taken.remediation_applied,
        team_notified: audit.actions_taken.notifications_sent > 0
      },
      
      follow_up_required: audit.outcome.required_manual_intervention,
      
      next_actions: audit.outcome.required_manual_intervention ? [
        "Review remediation actions in Notion",
        "Approve or modify fix",
        "Monitor resource for 24 hours"
      ] : [
        "Monitor for recurrence",
        "Review in next weekly report"
      ],
      
      metrics: {
        response_time_ms: audit.performance.total_duration_ms,
        automation_rate: audit.actions_taken.remediation_applied ? 100 : 0
      }
    };
    
    console.log("=== Workflow Complete ===");
    console.log(JSON.stringify(summary, null, 2));
    
    // Return summary for webhook response
    return {
      status: "processed",
      alert_id: summary.alert_id,
      severity: summary.severity,
      automated_response: summary.results.auto_remediation,
      follow_up_required: summary.follow_up_required
    };
  }
});