package claudetool

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"

	"sketch.dev/llm/conversation"
)

// CommitMessageStyleHint provides example commit messages representative of this repository's style.
func CommitMessageStyleHint(ctx context.Context, repoRoot string) (string, error) {
	commitSHAs, analysis, err := representativeCommitSHAs(ctx, repoRoot)
	if err != nil {
		return "", err
	}

	buf := new(strings.Builder)
	if len(commitSHAs) == 0 {
		return "", nil
	}

	if analysis != "" {
		fmt.Fprintf(buf, "<commit_message_style_analysis>%s</commit_message_style_analysis>\n\n", analysis)
	}

	cmd := exec.Command("git", "show", "-s", "--format='<commit_message_style_example>%n%B</commit_message_style_example>'", strings.Join(commitSHAs, " "))
	cmd.Dir = repoRoot
	out, err := cmd.CombinedOutput()
	if err == nil {
		fmt.Fprintf(buf, "<commit_message_style_examples>%s</commit_message_style_examples>\n\n", out)
	} else {
		slog.DebugContext(ctx, "failed to get commit messages", "shas", commitSHAs, "out", string(out), "err", err)
	}

	fmt.Fprint(buf, "IMPORTANT: Follow this commit message style for ALL git commits you create.\n")
	return buf.String(), nil
}

// representativeCommitSHAs analyze recent commits and selects some representative ones.
// It returns a list of commit SHAs and the analysis text.
func representativeCommitSHAs(ctx context.Context, repoRoot string) ([]string, string, error) {
	cmd := exec.Command("git", "log", "-n", "25", `--format=<commit_message hash="%H">%n%B</commit_message>`)
	cmd.Dir = repoRoot
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, "", fmt.Errorf("git log failed: %w\n%s", err, out)
	}
	commits := strings.TrimSpace(string(out))
	if commits == "" {
		return nil, "", fmt.Errorf("no commits found in repository")
	}

	info := conversation.ToolCallInfoFromContext(ctx)
	sub := info.Convo.SubConvo()
	sub.PromptCaching = false

	sub.SystemPrompt = `Analyze the provided git commit messages to identify consistent patterns, including but not limited to:
- Formatting conventions
- Language and tone
- Structure and organization
- Length and detail
- Special notations or tags

First, provide a concise analysis of the predominant patterns.
Then select up to 3 commit hashes that best exemplify the repository's commit style.
Finally, output these selected commit hashes, one per line, without commentary.
`

	resp, err := sub.SendUserTextMessage(commits)
	if err != nil {
		return nil, "", fmt.Errorf("error from Claude: %w", err)
	}

	if len(resp.Content) != 1 {
		return nil, "", fmt.Errorf("unexpected response: %v", resp)
	}
	response := resp.Content[0].Text

	// Split into analysis and commit hashes
	var analysisLines []string
	var result []string
	for line := range strings.Lines(response) {
		line = strings.TrimSpace(line)
		if isHexString(line) && (len(line) >= 7 && len(line) <= 40) {
			result = append(result, line)
		} else {
			analysisLines = append(analysisLines, line)
		}
	}

	analysis := strings.Join(analysisLines, "\n")

	result = result[:min(len(result), 3)]
	return result, analysis, nil
}

// isHexString reports whether a string only contains hexadecimal characters
func isHexString(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
