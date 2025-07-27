// Pipedream Cost Optimization Workflow
// Schedule: Daily at 6 AM UTC
// Purpose: Analyze cloud costs, detect anomalies, and generate optimization recommendations

// ============================================
// STEP 1: Fetch Multi-Cloud Cost Data
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Query AWS Unified MCP for cost data
    const costQueries = [
      { service: 'edge', query: 'cost analysis last 7d' },
      { service: 'oracle-mirror', query: 'resource costs' },
      { service: 'core', query: 'service usage metrics' }
    ];
    
    const costData = {};
    
    for (const query of costQueries) {
      try {
        const response = await fetch('http://localhost:3002/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(query)
        });
        
        costData[query.service] = await response.text();
      } catch (error) {
        console.error(`Failed to fetch ${query.service} costs:`, error);
        costData[query.service] = null;
      }
    }
    
    // Parse and aggregate costs
    const aggregatedCosts = {
      total_daily: 0,
      total_weekly: 0,
      by_service: {},
      by_resource: {},
      timestamp: today.toISOString()
    };
    
    // Mock cost parsing (in production, parse actual MCP responses)
    aggregatedCosts.total_daily = 47.23;
    aggregatedCosts.total_weekly = 285.67;
    aggregatedCosts.by_service = {
      'edge-devices': 12.45,
      'oracle-compute': 24.78,
      'networking': 10.00
    };
    aggregatedCosts.by_resource = {
      'pifive0': 4.15,
      'piiv': 4.15,
      'piiv2': 4.15,
      'oracle-vm-1': 24.78
    };
    
    $.export("cost_data", aggregatedCosts);
    console.log(`Total daily cost: $${aggregatedCosts.total_daily}`);
    
    return aggregatedCosts;
  }
});

// ============================================
// STEP 2: Anomaly Detection
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const currentCosts = steps.fetch_costs.$return_value;
    
    // Fetch historical averages from data store
    const historicalKey = 'cost_history_30d';
    const history = await $.data.get(historicalKey) || {
      daily_avg: 40.00,
      weekly_avg: 280.00,
      by_service_avg: {
        'edge-devices': 12.00,
        'oracle-compute': 20.00,
        'networking': 8.00
      }
    };
    
    const anomalies = [];
    
    // Check for daily anomalies (>20% increase)
    const dailyIncrease = ((currentCosts.total_daily - history.daily_avg) / history.daily_avg) * 100;
    if (dailyIncrease > 20) {
      anomalies.push({
        type: 'daily_spike',
        severity: dailyIncrease > 50 ? 'Critical' : 'High',
        current: currentCosts.total_daily,
        expected: history.daily_avg,
        increase_pct: dailyIncrease.toFixed(2),
        message: `Daily costs increased by ${dailyIncrease.toFixed(2)}%`
      });
    }
    
    // Check for service-level anomalies
    for (const [service, cost] of Object.entries(currentCosts.by_service)) {
      const avgCost = history.by_service_avg[service] || 0;
      if (avgCost > 0) {
        const increase = ((cost - avgCost) / avgCost) * 100;
        if (increase > 30) {
          anomalies.push({
            type: 'service_spike',
            severity: increase > 100 ? 'Critical' : 'High',
            service: service,
            current: cost,
            expected: avgCost,
            increase_pct: increase.toFixed(2),
            message: `${service} costs increased by ${increase.toFixed(2)}%`
          });
        }
      }
    }
    
    // Check for underutilized resources
    for (const [resource, cost] of Object.entries(currentCosts.by_resource)) {
      if (cost > 5 && resource.startsWith('oracle')) {
        // Query utilization via MCP
        anomalies.push({
          type: 'underutilized',
          severity: 'Medium',
          resource: resource,
          cost: cost,
          message: `${resource} may be underutilized (cost: $${cost}/day)`
        });
      }
    }
    
    // Update historical data
    await $.data.set(historicalKey, {
      ...history,
      last_update: new Date().toISOString(),
      recent_daily: [
        ...(history.recent_daily || []).slice(-29),
        currentCosts.total_daily
      ]
    });
    
    $.export("anomalies", anomalies);
    console.log(`Detected ${anomalies.length} cost anomalies`);
    
    return {
      anomaly_count: anomalies.length,
      anomalies: anomalies,
      analysis_timestamp: new Date().toISOString()
    };
  }
});

// ============================================
// STEP 3: Generate Optimization Recommendations
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const costData = steps.fetch_costs.$return_value;
    const anomalies = steps.anomaly_detection.$return_value;
    
    const recommendations = [];
    
    // Analyze anomalies and generate recommendations
    for (const anomaly of anomalies.anomalies) {
      if (anomaly.type === 'service_spike' && anomaly.service === 'oracle-compute') {
        recommendations.push({
          priority: 'High',
          category: 'Right-sizing',
          resource: anomaly.service,
          action: 'Review compute instance sizing',
          potential_savings: (anomaly.current * 0.3).toFixed(2),
          implementation: [
            'Analyze CPU/Memory utilization over past 7 days',
            'Consider downsizing from current instance type',
            'Enable auto-scaling if applicable'
          ]
        });
      }
      
      if (anomaly.type === 'underutilized') {
        recommendations.push({
          priority: 'Medium',
          category: 'Resource Optimization',
          resource: anomaly.resource,
          action: 'Consider consolidation or removal',
          potential_savings: (anomaly.cost * 0.8).toFixed(2),
          implementation: [
            'Review resource usage patterns',
            'Consider serverless alternatives',
            'Implement scheduled start/stop'
          ]
        });
      }
      
      if (anomaly.type === 'daily_spike') {
        recommendations.push({
          priority: 'High',
          category: 'Cost Control',
          resource: 'Overall Infrastructure',
          action: 'Investigate unexpected cost increase',
          potential_savings: ((anomaly.current - anomaly.expected) * 0.5).toFixed(2),
          implementation: [
            'Review recent deployments and changes',
            'Check for runaway processes or services',
            'Implement cost alerts and budgets'
          ]
        });
      }
    }
    
    // Add general optimization recommendations
    if (costData.total_daily > 40) {
      recommendations.push({
        priority: 'Low',
        category: 'Edge Optimization',
        resource: 'Edge Devices',
        action: 'Optimize edge processing schedules',
        potential_savings: '2.50',
        implementation: [
          'Batch process during off-peak hours',
          'Implement intelligent data filtering at edge',
          'Reduce data transmission frequency'
        ]
      });
    }
    
    // Calculate total potential savings
    const totalSavings = recommendations.reduce((sum, rec) => 
      sum + parseFloat(rec.potential_savings || 0), 0
    );
    
    $.export("recommendations", {
      count: recommendations.length,
      total_potential_savings: totalSavings.toFixed(2),
      recommendations: recommendations
    });
    
    console.log(`Generated ${recommendations.length} recommendations with potential savings of $${totalSavings.toFixed(2)}/day`);
    
    return recommendations;
  }
});

// ============================================
// STEP 4: Update Notion Cost Dashboard
// ============================================
export default defineComponent({
  props: {
    notion: {
      type: "app",
      app: "notion"
    }
  },
  async run({ steps, $ }) {
    const costData = steps.fetch_costs.$return_value;
    const recommendations = steps.generate_recommendations.$return_value;
    const anomalies = steps.anomaly_detection.$return_value;
    
    try {
      // Create cost analysis page
      const analysisPage = await this.notion.pages.create({
        parent: { database_id: "23be7cc7-01d5-813f-8bc4-e73325f0535a" },
        icon: { emoji: "💰" },
        properties: {
          "Name": {
            title: [{
              text: { 
                content: `Cost Analysis - ${new Date().toISOString().split('T')[0]}` 
              }
            }]
          },
          "Status": { select: { name: "Active" } },
          "Budget Monthly": { number: 1000 },
          "Current Month Spend": { 
            number: costData.total_weekly * 4.3 // Approximate monthly
          }
        },
        children: [
          {
            object: "block",
            type: "heading_1",
            heading_1: {
              rich_text: [{ text: { content: "📊 Daily Cost Summary" } }]
            }
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{
                text: { 
                  content: `Total Daily Cost: $${costData.total_daily}
Weekly Average: $${costData.total_weekly}
Anomalies Detected: ${anomalies.anomaly_count}`
                }
              }]
            }
          },
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [{ text: { content: "⚠️ Cost Anomalies" } }]
            }
          },
          {
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [{
                text: { 
                  content: anomalies.anomalies.map(a => 
                    `${a.severity}: ${a.message}`
                  ).join('\n') || "No anomalies detected"
                }
              }]
            }
          },
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [{ text: { content: "💡 Optimization Recommendations" } }]
            }
          },
          {
            object: "block",
            type: "table",
            table: {
              table_width: 4,
              has_column_header: true,
              has_row_header: false,
              children: [
                {
                  object: "block",
                  type: "table_row",
                  table_row: {
                    cells: [
                      [{ text: { content: "Priority" } }],
                      [{ text: { content: "Resource" } }],
                      [{ text: { content: "Action" } }],
                      [{ text: { content: "Potential Savings" } }]
                    ]
                  }
                },
                ...recommendations.slice(0, 5).map(rec => ({
                  object: "block",
                  type: "table_row",
                  table_row: {
                    cells: [
                      [{ text: { content: rec.priority } }],
                      [{ text: { content: rec.resource } }],
                      [{ text: { content: rec.action } }],
                      [{ text: { content: `$${rec.potential_savings}/day` } }]
                    ]
                  }
                }))
              ]
            }
          }
        ]
      });
      
      // Update resource inventory with optimization flags
      for (const rec of recommendations) {
        if (rec.resource && rec.resource !== 'Overall Infrastructure') {
          try {
            const resources = await this.notion.databases.query({
              database_id: "23be7cc7-01d5-81f0-a8cc-cfa88a213102",
              filter: {
                property: "Name",
                title: { contains: rec.resource }
              }
            });
            
            if (resources.results.length > 0) {
              await this.notion.pages.update({
                page_id: resources.results[0].id,
                properties: {
                  "Optimization Flag": {
                    select: { name: rec.category }
                  },
                  "Cost Optimization": {
                    rich_text: [{
                      text: { content: `Potential savings: $${rec.potential_savings}/day` }
                    }]
                  }
                }
              });
            }
          } catch (e) {
            console.error(`Failed to update resource ${rec.resource}:`, e);
          }
        }
      }
      
      $.export("notion_update", {
        page_created: analysisPage.id,
        resources_updated: recommendations.filter(r => r.resource).length
      });
      
      return {
        status: "success",
        page_url: analysisPage.url
      };
      
    } catch (error) {
      console.error("Notion update failed:", error);
      return { status: "failed", error: error.message };
    }
  }
});

// ============================================
// STEP 5: Send Cost Alert Notifications
// ============================================
export default defineComponent({
  props: {
    slack: {
      type: "app",
      app: "slack"
    }
  },
  async run({ steps, $ }) {
    const anomalies = steps.anomaly_detection.$return_value;
    const recommendations = steps.generate_recommendations.$return_value;
    const notionUpdate = steps.update_notion.$return_value;
    
    // Only send notifications if there are critical issues
    const criticalAnomalies = anomalies.anomalies.filter(a => a.severity === 'Critical');
    const highPriorityRecs = recommendations.filter(r => r.priority === 'High');
    
    if (criticalAnomalies.length === 0 && highPriorityRecs.length === 0) {
      return { status: "no_alerts_needed" };
    }
    
    // Build notification message
    const message = `🚨 *Daily Cost Analysis Alert*

*Critical Issues Detected:* ${criticalAnomalies.length}
*Total Potential Savings:* $${recommendations.reduce((sum, r) => sum + parseFloat(r.potential_savings || 0), 0).toFixed(2)}/day

${criticalAnomalies.length > 0 ? '*Critical Anomalies:*\n' + criticalAnomalies.map(a => 
  `• ${a.message} (${a.increase_pct}% increase)`
).join('\n') : ''}

*Top Recommendations:*
${highPriorityRecs.slice(0, 3).map(r => 
  `• ${r.action} - Save $${r.potential_savings}/day`
).join('\n')}

View full analysis: ${notionUpdate.page_url || 'Check Notion'}`;
    
    try {
      await this.slack.sdk.chat.postMessage({
        channel: "#cloud-costs",
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
                url: notionUpdate.page_url,
                style: "primary"
              },
              {
                type: "button",
                text: { type: "plain_text", text: "Implement Optimizations" },
                value: "implement_optimizations"
              }
            ]
          }
        ]
      });
      
      return { status: "notification_sent", channel: "slack" };
      
    } catch (error) {
      console.error("Slack notification failed:", error);
      
      // Fallback to console
      console.log("=== COST ALERT ===");
      console.log(message);
      
      return { status: "notification_logged", channel: "console" };
    }
  }
});

// ============================================
// STEP 6: Store Analysis History
// ============================================
export default defineComponent({
  async run({ steps, $ }) {
    const costData = steps.fetch_costs.$return_value;
    const anomalies = steps.anomaly_detection.$return_value;
    const recommendations = steps.generate_recommendations.$return_value;
    
    const analysisRecord = {
      execution_id: $.id,
      timestamp: new Date().toISOString(),
      costs: {
        daily: costData.total_daily,
        weekly: costData.total_weekly,
        by_service: costData.by_service
      },
      anomalies: {
        count: anomalies.anomaly_count,
        critical: anomalies.anomalies.filter(a => a.severity === 'Critical').length,
        types: [...new Set(anomalies.anomalies.map(a => a.type))]
      },
      recommendations: {
        count: recommendations.length,
        potential_savings: recommendations.reduce((sum, r) => 
          sum + parseFloat(r.potential_savings || 0), 0
        ).toFixed(2),
        categories: [...new Set(recommendations.map(r => r.category))]
      }
    };
    
    // Store in Pipedream data store with 90-day retention
    const historyKey = `cost_analysis_${new Date().toISOString().split('T')[0]}`;
    await $.data.set(historyKey, analysisRecord, { ttl: 7776000 });
    
    // Update running metrics
    const metricsKey = 'cost_optimization_metrics';
    const metrics = await $.data.get(metricsKey) || {
      analyses_run: 0,
      total_anomalies_detected: 0,
      total_savings_identified: 0,
      avg_daily_cost: 0
    };
    
    metrics.analyses_run += 1;
    metrics.total_anomalies_detected += anomalies.anomaly_count;
    metrics.total_savings_identified += parseFloat(analysisRecord.recommendations.potential_savings);
    metrics.avg_daily_cost = ((metrics.avg_daily_cost * (metrics.analyses_run - 1)) + costData.total_daily) / metrics.analyses_run;
    metrics.last_run = new Date().toISOString();
    
    await $.data.set(metricsKey, metrics);
    
    console.log(`Analysis complete. Total savings identified to date: $${metrics.total_savings_identified.toFixed(2)}`);
    
    return {
      status: "completed",
      execution_id: $.id,
      metrics: {
        runs_completed: metrics.analyses_run,
        lifetime_savings_identified: metrics.total_savings_identified.toFixed(2)
      }
    };
  }
});