import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

/**
 * Class to handle terminal functionality in the timeline UI.
 */
export class TerminalHandler {
  // Terminal instance
  private terminal: Terminal | null = null;
  // Terminal fit addon for handling resize
  private fitAddon: FitAddon | null = null;
  // Terminal EventSource for SSE
  private terminalEventSource: EventSource | null = null;
  // Terminal ID (always 1 for now, will support 1-9 later)
  private terminalId: string = "1";
  // Queue for serializing terminal inputs
  private terminalInputQueue: string[] = [];
  // Flag to track if we're currently processing a terminal input
  private processingTerminalInput: boolean = false;
  // Current view mode (needed for resize handling)
  private viewMode: string = "chat";

  /**
   * Constructor for TerminalHandler
   */
  constructor() {}

  /**
   * Sets the current view mode
   * @param mode The current view mode
   */
  public setViewMode(mode: string): void {
    this.viewMode = mode;
  }

  /**
   * Initialize the terminal component
   * @param terminalContainer The DOM element to contain the terminal
   */
  public async initializeTerminal(): Promise<void> {
    const terminalContainer = document.getElementById("terminalContainer");

    if (!terminalContainer) {
      console.error("Terminal container not found");
      return;
    }

    // If terminal is already initialized, just focus it
    if (this.terminal) {
      this.terminal.focus();
      if (this.fitAddon) {
        this.fitAddon.fit();
      }
      return;
    }

    // Clear the terminal container
    terminalContainer.innerHTML = "";

    // Create new terminal instance
    this.terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: "#f5f5f5",
        foreground: "#333333",
        cursor: "#0078d7",
        selectionBackground: "rgba(0, 120, 215, 0.4)",
      },
    });

    // Add fit addon to handle terminal resizing
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // Open the terminal in the container
    this.terminal.open(terminalContainer);

    // Connect to WebSocket
    await this.connectTerminal();

    // Fit the terminal to the container
    this.fitAddon.fit();

    // Setup resize handler
    window.addEventListener("resize", () => {
      if (this.viewMode === "terminal" && this.fitAddon) {
        this.fitAddon.fit();
        // Send resize information to server
        this.sendTerminalResize();
      }
    });

    // Focus the terminal
    this.terminal.focus();
  }

  /**
   * Connect to terminal events stream
   */
  private async connectTerminal(): Promise<void> {
    if (!this.terminal) {
      return;
    }

    // Close existing connections if any
    this.closeTerminalConnections();

    try {
      // Connect directly to the SSE endpoint for terminal 1
      // Use relative URL based on current location
      const baseUrl = window.location.pathname.endsWith('/') ? '.' : '.';
      const eventsUrl = `${baseUrl}/terminal/events/${this.terminalId}`;
      this.terminalEventSource = new EventSource(eventsUrl);
      
      // Handle SSE events
      this.terminalEventSource.onopen = () => {
        console.log("Terminal SSE connection opened");
        this.sendTerminalResize();
      };
      
      this.terminalEventSource.onmessage = (event) => {
        if (this.terminal) {
          // Decode base64 data before writing to terminal
          try {
            const decoded = atob(event.data);
            this.terminal.write(decoded);
          } catch (e) {
            console.error('Error decoding terminal data:', e);
            // Fallback to raw data if decoding fails
            this.terminal.write(event.data);
          }
        }
      };
      
      this.terminalEventSource.onerror = (error) => {
        console.error("Terminal SSE error:", error);
        if (this.terminal) {
          this.terminal.write("\r\n\x1b[1;31mConnection error\x1b[0m\r\n");
        }
        // Attempt to reconnect if the connection was lost
        if (this.terminalEventSource?.readyState === EventSource.CLOSED) {
          this.closeTerminalConnections();
        }
      };
      
      // Send key inputs to the server via POST requests
      if (this.terminal) {
        this.terminal.onData((data) => {
          this.sendTerminalInput(data);
        });
      }
    } catch (error) {
      console.error("Failed to connect to terminal:", error);
      if (this.terminal) {
        this.terminal.write(`\r\n\x1b[1;31mFailed to connect: ${error}\x1b[0m\r\n`);
      }
    }
  }

  /**
   * Close any active terminal connections
   */
  private closeTerminalConnections(): void {
    if (this.terminalEventSource) {
      this.terminalEventSource.close();
      this.terminalEventSource = null;
    }
  }

  /**
   * Send input to the terminal
   * @param data The input data to send
   */
  private async sendTerminalInput(data: string): Promise<void> {
    // Add the data to the queue
    this.terminalInputQueue.push(data);
    
    // If we're not already processing inputs, start processing
    if (!this.processingTerminalInput) {
      await this.processTerminalInputQueue();
    }
  }

  /**
   * Process the terminal input queue in order
   */
  private async processTerminalInputQueue(): Promise<void> {
    if (this.terminalInputQueue.length === 0) {
      this.processingTerminalInput = false;
      return;
    }
    
    this.processingTerminalInput = true;
    
    // Concatenate all available inputs from the queue into a single request
    let combinedData = '';
    
    // Take all currently available items from the queue
    while (this.terminalInputQueue.length > 0) {
      combinedData += this.terminalInputQueue.shift()!;
    }
    
    try {
      // Use relative URL based on current location
      const baseUrl = window.location.pathname.endsWith('/') ? '.' : '.';
      const response = await fetch(`${baseUrl}/terminal/input/${this.terminalId}`, {
        method: 'POST',
        body: combinedData,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to send terminal input: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error sending terminal input:", error);
    }
    
    // Continue processing the queue (for any new items that may have been added)
    await this.processTerminalInputQueue();
  }

  /**
   * Send terminal resize information to the server
   */
  private async sendTerminalResize(): Promise<void> {
    if (!this.terminal || !this.fitAddon) {
      return;
    }

    // Get terminal dimensions
    try {
      // Send resize message in a format the server can understand
      // Use relative URL based on current location
      const baseUrl = window.location.pathname.endsWith('/') ? '.' : '.';
      const response = await fetch(`${baseUrl}/terminal/input/${this.terminalId}`, {
        method: 'POST',
        body: JSON.stringify({
          type: "resize",
          cols: this.terminal.cols || 80, // Default to 80 if undefined
          rows: this.terminal.rows || 24, // Default to 24 if undefined
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to send terminal resize: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error sending terminal resize:", error);
    }
  }

  /**
   * Clean up resources when component is destroyed
   */
  public dispose(): void {
    this.closeTerminalConnections();
    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = null;
    }
    this.fitAddon = null;
  }
}
