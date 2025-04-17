/**
 * Interface for a Git commit
 */
export interface GitCommit {
  hash: string; // Full commit hash
  subject: string; // Commit subject line
  body: string; // Full commit message body
  pushed_branch?: string; // If set, this commit was pushed to this branch
}

/**
 * Interface for a tool call
 */
export interface ToolCall {
  name: string;
  args?: string;
  result?: string;
  input?: string; // Input property for TypeScript compatibility
  tool_call_id?: string;
}

/**
 * Interface for a timeline message
 */
export interface TimelineMessage {
  type: string;
  content?: string;
  timestamp?: string | number | Date;
  elapsed?: number;
  turnDuration?: number; // Turn duration field
  end_of_turn?: boolean;
  conversation_id?: string;
  parent_conversation_id?: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
  tool_error?: boolean;
  tool_call_id?: string;
  commits?: GitCommit[]; // For commit messages
  input?: string; // Input property
  tool_result?: string; // Tool result property
  toolResponses?: any[]; // Tool responses array
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    cost_usd?: number;
  };
}
