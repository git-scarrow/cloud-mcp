/**
 * Resource Anomaly Detection Workflow - Pipedream Template
 * Real-time monitoring for resource anomalies and immediate alerting
 */

export default {
  name: "Cloud-Ops Resource Anomaly Detection",
  version: "0.1.0", 
  props: {
    // HTTP trigger - receives anomaly data from metrics collection
    http: {
      type: "$.interface.http",
      customResponse: true,
    },
    // Anomaly detection thresholds
    critical_anomaly_threshold: {
      type: "number",
      label: "Critical Anomaly Threshold",
      description: "Anomaly score above this triggers immediate alerts",
      default: 0.8
    },
    warning_anomaly_threshold: {
      type: "number", 
      label: "Warning Anomaly Threshold",
      description: "Anomaly score above this triggers warnings",
      default: 0.6
    },
    // Notification settings
    slack_webhook_url: {
      type: "string",
      label: "Slack Webhook URL",
      description: "Slack webhook for anomaly alerts",
      optional: true
    },
    pagerduty_integration_key: {
      type: "string",
      label: "PagerDuty Integration Key",
      description: "PagerDuty key for critical alerts",
      optional: true,
      secret: true
    },
    email_recipient: {
      type: "string",
      label: "Alert Email",
      description: "Email address for anomaly alerts",
      optional: true
    },
    // Notion integration
    notion_token: {
      type: "string",
      label: "Notion Integration Token",
      secret: true
    },
    notion_incidents_db: {
      type: "string",
      label: "Notion Incidents Database ID",
      description: "Database ID for creating incident tickets"
    }
  },

  async run({ steps, $ }) {
    // Step 1: Parse incoming anomaly data
    const anomalyData = steps.trigger.event.body;
    console.log("Received anomaly data:", anomalyData);

    const {
      resource_id,
      resource_uuid, 
      provider,
      resource_type,
      anomaly_score,
      current_metrics,
      historical_baseline,
      anomaly_details,
      timestamp
    } = anomalyData;

    // Step 2: Determine anomaly severity
    let severity = "info";
    let alertTitle = "";
    let shouldAlert = false;
    let shouldPage = false;

    if (anomaly_score >= this.critical_anomaly_threshold) {
      severity = "critical";
      alertTitle = `🚨 CRITICAL ANOMALY: ${provider} ${resource_type}`;
      shouldAlert = true;
      shouldPage = true;
    } else if (anomaly_score >= this.warning_anomaly_threshold) {
      severity = "warning"; 
      alertTitle = `⚠️ ANOMALY WARNING: ${provider} ${resource_type}`;
      shouldAlert = true;
      shouldPage = false;
    } else {
      severity = "info";
      alertTitle = `ℹ️ Anomaly Detected: ${provider} ${resource_type}`;
      shouldAlert = false;
      shouldPage = false;
    }

    // Step 3: Generate anomaly analysis
    const analysis = {
      severity,
      anomaly_score,
      resource_info: {
        id: resource_id,
        uuid: resource_uuid,
        provider,
        type: resource_type
      },
      metrics_comparison: {
        current: current_metrics,
        baseline: historical_baseline,
        deviation: {}
      },
      anomaly_indicators: [],
      recommended_actions: []
    };

    // Calculate deviations
    Object.keys(current_metrics).forEach(metric => {
      if (historical_baseline[metric]) {
        const current = current_metrics[metric];
        const baseline = historical_baseline[metric];
        const deviation = ((current - baseline) / baseline) * 100;
        analysis.metrics_comparison.deviation[metric] = deviation;

        if (Math.abs(deviation) > 50) { // >50% deviation
          analysis.anomaly_indicators.push({
            metric,
            current_value: current,
            baseline_value: baseline,
            deviation_percent: deviation.toFixed(1)
          });
        }
      }
    });

    // Generate recommendations based on anomaly type
    if (anomaly_details.type === "cpu_spike") {
      analysis.recommended_actions.push("Investigate CPU-intensive processes");
      analysis.recommended_actions.push("Check for resource contention");
      analysis.recommended_actions.push("Consider scaling up if sustained");
    } else if (anomaly_details.type === "memory_leak") {
      analysis.recommended_actions.push("Investigate memory usage patterns");
      analysis.recommended_actions.push("Check application logs for memory leaks");
      analysis.recommended_actions.push("Consider restarting affected services");
    } else if (anomaly_details.type === "cost_anomaly") {
      analysis.recommended_actions.push("Review recent configuration changes");
      analysis.recommended_actions.push("Check for unexpected data transfer costs");
      analysis.recommended_actions.push("Verify resource scaling activities");
    }

    // Step 4: Send PagerDuty alert for critical anomalies
    if (shouldPage && this.pagerduty_integration_key) {
      await $.send.http({
        url: "https://events.pagerduty.com/v2/enqueue",
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        data: {
          routing_key: this.pagerduty_integration_key,
          event_action: "trigger",
          dedup_key: `anomaly-${resource_uuid}-${Date.now()}`,
          payload: {
            summary: `Critical Resource Anomaly: ${resource_id}`,
            severity: "critical", 
            source: "cloud-ops-anomaly-detection",
            component: resource_type,
            group: provider,
            class: "resource_anomaly",
            custom_details: {
              resource_id,
              resource_uuid,
              anomaly_score,
              anomaly_indicators: analysis.anomaly_indicators,
              recommended_actions: analysis.recommended_actions
            }
          }
        }
      });
      console.log("PagerDuty alert triggered");
    }

    // Step 5: Send Slack alert
    if (shouldAlert && this.slack_webhook_url) {
      const slackColor = severity === "critical" ? "danger" : "warning";
      const anomalyFields = analysis.anomaly_indicators.map(indicator => ({
        title: `${indicator.metric.toUpperCase()} Deviation`,
        value: `${indicator.deviation_percent}% (${indicator.current_value} vs ${indicator.baseline_value} baseline)`,
        short: true
      }));

      await $.send.http({
        url: this.slack_webhook_url,
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        data: {
          text: alertTitle,
          attachments: [{
            color: slackColor,
            fields: [
              {
                title: "Resource",
                value: `${provider} ${resource_type} (${resource_uuid})`,
                short: true
              },
              {
                title: "Anomaly Score", 
                value: anomaly_score.toFixed(3),
                short: true
              },
              ...anomalyFields,
              {
                title: "Recommended Actions",
                value: analysis.recommended_actions.join("\n• "),
                short: false
              }
            ],
            footer: "Cloud-Ops Anomaly Detection",
            ts: Math.floor(new Date(timestamp).getTime() / 1000)
          }]
        }
      });
      console.log("Slack alert sent");
    }

    // Step 6: Send email alert for critical anomalies
    if (shouldAlert && this.email_recipient) {
      const emailSubject = severity === "critical" 
        ? `CRITICAL: Resource Anomaly Detected - ${resource_id}`
        : `WARNING: Resource Anomaly Detected - ${resource_id}`;

      const anomalyTable = analysis.anomaly_indicators.map(indicator => `
        <tr>
          <td>${indicator.metric}</td>
          <td>${indicator.current_value}</td>
          <td>${indicator.baseline_value}</td>
          <td style="color: ${Math.abs(parseFloat(indicator.deviation_percent)) > 100 ? 'red' : 'orange'}">
            ${indicator.deviation_percent}%
          </td>
        </tr>
      `).join('');

      const htmlContent = `
        <h2>${alertTitle}</h2>
        
        <h3>Resource Information</h3>
        <ul>
          <li><strong>Resource ID:</strong> ${resource_id}</li>
          <li><strong>UUID:</strong> ${resource_uuid}</li>
          <li><strong>Provider:</strong> ${provider}</li>
          <li><strong>Type:</strong> ${resource_type}</li>
          <li><strong>Anomaly Score:</strong> ${anomaly_score.toFixed(3)}</li>
          <li><strong>Timestamp:</strong> ${timestamp}</li>
        </ul>

        <h3>Metric Deviations</h3>
        <table border="1" style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th>Metric</th>
              <th>Current Value</th>
              <th>Baseline</th>
              <th>Deviation</th>
            </tr>
          </thead>
          <tbody>
            ${anomalyTable}
          </tbody>
        </table>

        <h3>Recommended Actions</h3>
        <ul>
          ${analysis.recommended_actions.map(action => `<li>${action}</li>`).join('')}
        </ul>

        <p><em>This alert was generated by the Cloud-Ops Anomaly Detection system.</em></p>
      `;

      await $.send.email({
        to: this.email_recipient,
        subject: emailSubject,
        html: htmlContent
      });
      console.log("Email alert sent");
    }

    // Step 7: Create Notion incident ticket for critical anomalies
    if (severity === "critical" && this.notion_token) {
      try {
        const notionResponse = await $.send.http({
          url: "https://api.notion.com/v1/pages",
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.notion_token}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28"
          },
          data: {
            parent: {
              database_id: this.notion_incidents_db
            },
            properties: {
              "Title": {
                title: [
                  {
                    text: {
                      content: `🚨 Critical Anomaly: ${resource_type} (Score: ${anomaly_score.toFixed(3)})`
                    }
                  }
                ]
              },
              "Severity": {
                select: {
                  name: "Critical"
                }
              },
              "Status": {
                select: {
                  name: "Open"
                }
              },
              "Resource": {
                rich_text: [
                  {
                    text: {
                      content: `${provider} ${resource_type} - ${resource_uuid}`
                    }
                  }
                ]
              },
              "Created": {
                date: {
                  start: new Date().toISOString()
                }
              }
            },
            children: [
              {
                object: "block",
                type: "heading_2", 
                heading_2: {
                  rich_text: [
                    {
                      type: "text",
                      text: {
                        content: `Anomaly Score: ${anomaly_score.toFixed(3)}`
                      }
                    }
                  ]
                }
              },
              {
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [
                    {
                      type: "text",
                      text: {
                        content: `Critical anomaly detected on ${resource_id} at ${timestamp}. Immediate investigation required.`
                      }
                    }
                  ]
                }
              },
              ...analysis.anomaly_indicators.map(indicator => ({
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                  rich_text: [
                    {
                      type: "text",
                      text: {
                        content: `${indicator.metric}: ${indicator.current_value} (${indicator.deviation_percent}% deviation from baseline ${indicator.baseline_value})`
                      }
                    }
                  ]
                }
              })),
              {
                object: "block",
                type: "heading_3",
                heading_3: {
                  rich_text: [
                    {
                      type: "text", 
                      text: {
                        content: "Recommended Actions"
                      }
                    }
                  ]
                }
              },
              ...analysis.recommended_actions.map(action => ({
                object: "block", 
                type: "to_do",
                to_do: {
                  rich_text: [
                    {
                      type: "text",
                      text: {
                        content: action
                      }
                    }
                  ],
                  checked: false
                }
              }))
            ]
          }
        });
        console.log("Notion incident created:", notionResponse.data?.id);
      } catch (error) {
        console.error("Failed to create Notion incident:", error);
      }
    }

    // Step 8: Return response
    await $.respond({
      status: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        success: true,
        severity,
        anomaly_score,
        alerts_sent: shouldAlert,
        analysis,
        timestamp: new Date().toISOString()
      }
    });

    return {
      severity,
      anomaly_score,
      alerts_sent: shouldAlert,
      pager_triggered: shouldPage,
      analysis,
      actions_taken: [
        shouldPage && this.pagerduty_integration_key ? "pagerduty_alert" : null,
        shouldAlert && this.slack_webhook_url ? "slack_alert" : null,
        shouldAlert && this.email_recipient ? "email_alert" : null,
        severity === "critical" && this.notion_token ? "notion_incident" : null
      ].filter(Boolean)
    };
  }
};