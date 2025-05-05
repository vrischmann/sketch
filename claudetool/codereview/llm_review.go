package codereview

import (
	"context"
	_ "embed"
	"fmt"
	"os/exec"
	"strings"

	"sketch.dev/llm"
	"sketch.dev/llm/conversation"
)

//go:embed llm_codereview_prompt.txt
var llmCodereviewPrompt string

// doLLMReview analyzes the diff using an LLM subagent.
func (r *CodeReviewer) doLLMReview(ctx context.Context) (string, error) {
	// Get the full diff between initial commit and HEAD
	cmd := exec.CommandContext(ctx, "git", "diff", r.initialCommit, "HEAD")
	cmd.Dir = r.repoRoot
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to get diff: %w\n%s", err, out)
	}

	// If no diff, nothing to check
	if len(out) == 0 {
		return "", nil
	}

	info := conversation.ToolCallInfoFromContext(ctx)
	convo := info.Convo.SubConvo()
	convo.SystemPrompt = strings.TrimSpace(llmCodereviewPrompt)
	initialMessage := llm.UserStringMessage("<diff>\n" + string(out) + "\n</diff>")

	resp, err := convo.SendMessage(initialMessage)
	if err != nil {
		return "", fmt.Errorf("failed to send LLM codereview message: %w", err)
	}
	if len(resp.Content) != 1 {
		return "", fmt.Errorf("unexpected number of content blocks in LLM codereview response: %d", len(resp.Content))
	}

	response := resp.Content[0].Text
	if strings.TrimSpace(response) == "No comments." {
		return "", nil
	}
	return response, nil
}
