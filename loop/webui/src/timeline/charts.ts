import type { TimelineMessage } from "./types";
import vegaEmbed from "vega-embed";
import { TopLevelSpec } from "vega-lite";

/**
 * ChartManager handles all chart-related functionality for the timeline.
 * This includes rendering charts, calculating data, and managing chart state.
 */
export class ChartManager {
  private chartData: { timestamp: Date; cost: number }[] = [];

  /**
   * Create a new ChartManager instance
   */
  constructor() {
    this.chartData = [];
  }

  /**
   * Calculate cumulative cost data from messages
   */
  public calculateCumulativeCostData(
    messages: TimelineMessage[],
  ): { timestamp: Date; cost: number }[] {
    if (!messages || messages.length === 0) {
      return [];
    }

    let cumulativeCost = 0;
    const data: { timestamp: Date; cost: number }[] = [];

    for (const message of messages) {
      if (message.timestamp && message.usage && message.usage.cost_usd) {
        const timestamp = new Date(message.timestamp);
        cumulativeCost += message.usage.cost_usd;

        data.push({
          timestamp,
          cost: cumulativeCost,
        });
      }
    }

    return data;
  }

  /**
   * Get the current chart data
   */
  public getChartData(): { timestamp: Date; cost: number }[] {
    return this.chartData;
  }

  /**
   * Set chart data
   */
  public setChartData(data: { timestamp: Date; cost: number }[]): void {
    this.chartData = data;
  }

  /**
   * Fetch all messages to generate chart data
   */
  public async fetchAllMessages(): Promise<void> {
    try {
      // Fetch all messages in a single request
      const response = await fetch("messages");
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const allMessages = await response.json();
      if (Array.isArray(allMessages)) {
        // Sort messages chronologically
        allMessages.sort((a, b) => {
          const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return dateA - dateB;
        });

        // Calculate cumulative cost data
        this.chartData = this.calculateCumulativeCostData(allMessages);
      }
    } catch (error) {
      console.error("Error fetching messages for chart:", error);
      this.chartData = [];
    }
  }

  /**
   * Render all charts in the chart view
   */
  public async renderCharts(): Promise<void> {
    const chartContainer = document.getElementById("chartContainer");
    if (!chartContainer) return;

    try {
      // Show loading state
      chartContainer.innerHTML = "<div class='loader'></div>";

      // Fetch messages if necessary
      if (this.chartData.length === 0) {
        await this.fetchAllMessages();
      }

      // Clear the container for multiple charts
      chartContainer.innerHTML = "";

      // Create cost chart container
      const costChartDiv = document.createElement("div");
      costChartDiv.className = "chart-section";
      costChartDiv.innerHTML =
        "<h3>Dollar Usage Over Time</h3><div id='costChart'></div>";
      chartContainer.appendChild(costChartDiv);

      // Create messages chart container
      const messagesChartDiv = document.createElement("div");
      messagesChartDiv.className = "chart-section";
      messagesChartDiv.innerHTML =
        "<h3>Message Timeline</h3><div id='messagesChart'></div>";
      chartContainer.appendChild(messagesChartDiv);

      // Render both charts
      await this.renderDollarUsageChart();
      await this.renderMessagesChart();
    } catch (error) {
      console.error("Error rendering charts:", error);
      chartContainer.innerHTML = `<p>Error rendering charts: ${error instanceof Error ? error.message : "Unknown error"}</p>`;
    }
  }

  /**
   * Render the dollar usage chart using Vega-Lite
   */
  private async renderDollarUsageChart(): Promise<void> {
    const costChartContainer = document.getElementById("costChart");
    if (!costChartContainer) return;

    try {
      // Display cost chart using Vega-Lite
      if (this.chartData.length === 0) {
        costChartContainer.innerHTML =
          "<p>No cost data available to display.</p>";
        return;
      }

      // Create a Vega-Lite spec for the line chart
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const costSpec: any = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Cumulative cost over time",
        width: "container",
        height: 300,
        data: {
          values: this.chartData.map((d) => ({
            timestamp: d.timestamp.toISOString(),
            cost: d.cost,
          })),
        },
        mark: {
          type: "line",
          point: true,
        },
        encoding: {
          x: {
            field: "timestamp",
            type: "temporal",
            title: "Time",
            axis: {
              format: "%H:%M:%S",
              title: "Time",
              labelAngle: -45,
            },
          },
          y: {
            field: "cost",
            type: "quantitative",
            title: "Cumulative Cost (USD)",
            axis: {
              format: "$,.4f",
            },
          },
          tooltip: [
            {
              field: "timestamp",
              type: "temporal",
              title: "Time",
              format: "%Y-%m-%d %H:%M:%S",
            },
            {
              field: "cost",
              type: "quantitative",
              title: "Cumulative Cost",
              format: "$,.4f",
            },
          ],
        },
      };

      // Render the cost chart
      await vegaEmbed(costChartContainer, costSpec, {
        actions: true,
        renderer: "svg",
      });
    } catch (error) {
      console.error("Error rendering dollar usage chart:", error);
      costChartContainer.innerHTML = `<p>Error rendering dollar usage chart: ${error instanceof Error ? error.message : "Unknown error"}</p>`;
    }
  }

  /**
   * Render the messages timeline chart using Vega-Lite
   */
  private async renderMessagesChart(): Promise<void> {
    const messagesChartContainer = document.getElementById("messagesChart");
    if (!messagesChartContainer) return;

    try {
      // Get all messages
      const response = await fetch("messages");
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const allMessages = await response.json();
      if (!Array.isArray(allMessages) || allMessages.length === 0) {
        messagesChartContainer.innerHTML =
          "<p>No messages available to display.</p>";
        return;
      }

      // Sort messages chronologically
      allMessages.sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dateA - dateB;
      });

      // Create unique indexes for all messages
      const messageIndexMap = new Map<string, number>();
      allMessages.forEach((msg, index) => {
        // Create a unique ID for each message to track its position
        const msgId = msg.timestamp ? msg.timestamp.toString() : `msg-${index}`;
        messageIndexMap.set(msgId, index);
      });

      // Prepare data for messages with start_time and end_time (bar marks)
      const barData = allMessages
        .filter((msg) => msg.start_time && msg.end_time) // Only include messages with explicit start and end times
        .map((msg) => {
          // Parse start and end times
          const startTime = new Date(msg.start_time!);
          const endTime = new Date(msg.end_time!);

          // Get the index for this message
          const msgId = msg.timestamp ? msg.timestamp.toString() : "";
          const index = messageIndexMap.get(msgId) || 0;

          // Truncate content for tooltip readability
          const displayContent = msg.content
            ? msg.content.length > 100
              ? msg.content.substring(0, 100) + "..."
              : msg.content
            : "No content";

          // Prepare tool input and output for tooltip if applicable
          const toolInput = msg.input
            ? msg.input.length > 100
              ? msg.input.substring(0, 100) + "..."
              : msg.input
            : "";

          const toolResult = msg.tool_result
            ? msg.tool_result.length > 100
              ? msg.tool_result.substring(0, 100) + "..."
              : msg.tool_result
            : "";

          return {
            index: index,
            message_type: msg.type,
            content: displayContent,
            tool_name: msg.tool_name || "",
            tool_input: toolInput,
            tool_result: toolResult,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            message: JSON.stringify(msg, null, 2), // Full message for detailed inspection
          };
        });

      // Prepare data for messages with timestamps only (point marks)
      const pointData = allMessages
        .filter((msg) => msg.timestamp && !(msg.start_time && msg.end_time)) // Only messages with timestamp but without start/end times
        .map((msg) => {
          // Get the timestamp
          const timestamp = new Date(msg.timestamp!);

          // Get the index for this message
          const msgId = msg.timestamp ? msg.timestamp.toString() : "";
          const index = messageIndexMap.get(msgId) || 0;

          // Truncate content for tooltip readability
          const displayContent = msg.content
            ? msg.content.length > 100
              ? msg.content.substring(0, 100) + "..."
              : msg.content
            : "No content";

          // Prepare tool input and output for tooltip if applicable
          const toolInput = msg.input
            ? msg.input.length > 100
              ? msg.input.substring(0, 100) + "..."
              : msg.input
            : "";

          const toolResult = msg.tool_result
            ? msg.tool_result.length > 100
              ? msg.tool_result.substring(0, 100) + "..."
              : msg.tool_result
            : "";

          return {
            index: index,
            message_type: msg.type,
            content: displayContent,
            tool_name: msg.tool_name || "",
            tool_input: toolInput,
            tool_result: toolResult,
            time: timestamp.toISOString(),
            message: JSON.stringify(msg, null, 2), // Full message for detailed inspection
          };
        });

      // Check if we have any data to display
      if (barData.length === 0 && pointData.length === 0) {
        messagesChartContainer.innerHTML =
          "<p>No message timing data available to display.</p>";
        return;
      }

      // Calculate height based on number of unique messages
      const chartHeight = 20 * Math.min(allMessages.length, 25); // Max 25 visible at once

      // Create a layered Vega-Lite spec combining bars and points
      const messagesSpec: TopLevelSpec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Message Timeline",
        width: "container",
        height: chartHeight,
        layer: [],
      };

      // Add bar layer if we have bar data
      if (barData.length > 0) {
        messagesSpec.layer.push({
          data: { values: barData },
          mark: {
            type: "bar",
            height: 16,
          },
          encoding: {
            x: {
              field: "start_time",
              type: "temporal",
              title: "Time",
              axis: {
                format: "%H:%M:%S",
                title: "Time",
                labelAngle: -45,
              },
            },
            x2: { field: "end_time" },
            y: {
              field: "index",
              type: "ordinal",
              title: "Message Index",
              axis: {
                grid: true,
              },
            },
            color: {
              field: "message_type",
              type: "nominal",
              title: "Message Type",
              legend: {},
            },
            tooltip: [
              { field: "message_type", type: "nominal", title: "Type" },
              { field: "tool_name", type: "nominal", title: "Tool" },
              {
                field: "start_time",
                type: "temporal",
                title: "Start Time",
                format: "%H:%M:%S.%L",
              },
              {
                field: "end_time",
                type: "temporal",
                title: "End Time",
                format: "%H:%M:%S.%L",
              },
              { field: "content", type: "nominal", title: "Content" },
              { field: "tool_input", type: "nominal", title: "Tool Input" },
              { field: "tool_result", type: "nominal", title: "Tool Result" },
            ],
          },
        });
      }

      // Add point layer if we have point data
      if (pointData.length > 0) {
        messagesSpec.layer.push({
          data: { values: pointData },
          mark: {
            type: "point",
            size: 100,
            filled: true,
          },
          encoding: {
            x: {
              field: "time",
              type: "temporal",
              title: "Time",
              axis: {
                format: "%H:%M:%S",
                title: "Time",
                labelAngle: -45,
              },
            },
            y: {
              field: "index",
              type: "ordinal",
              title: "Message Index",
            },
            color: {
              field: "message_type",
              type: "nominal",
              title: "Message Type",
            },
            tooltip: [
              { field: "message_type", type: "nominal", title: "Type" },
              { field: "tool_name", type: "nominal", title: "Tool" },
              {
                field: "time",
                type: "temporal",
                title: "Timestamp",
                format: "%H:%M:%S.%L",
              },
              { field: "content", type: "nominal", title: "Content" },
              { field: "tool_input", type: "nominal", title: "Tool Input" },
              { field: "tool_result", type: "nominal", title: "Tool Result" },
            ],
          },
        });
      }

      // Render the messages timeline chart
      await vegaEmbed(messagesChartContainer, messagesSpec, {
        actions: true,
        renderer: "svg",
      });
    } catch (error) {
      console.error("Error rendering messages chart:", error);
      messagesChartContainer.innerHTML = `<p>Error rendering messages chart: ${error instanceof Error ? error.message : "Unknown error"}</p>`;
    }
  }
}
