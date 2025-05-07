package claudetool

import (
	"context"
	"fmt"
	"os/exec"
	"strings"

	"sketch.dev/llm/conversation"
)

// CommitMessageStyleHint explains how to find commit messages representative of this repository's style.
func CommitMessageStyleHint(ctx context.Context, repoRoot string) (string, error) {
	commitSHAs, err := representativeCommitSHAs(ctx, repoRoot)
	if err != nil {
		return "", err
	}

	buf := new(strings.Builder)
	if len(commitSHAs) > 0 {
		fmt.Fprint(buf, "To see representative commit messages for this repository, run:\n\n")
		fmt.Fprintf(buf, "git show -s --format='<commit_message>%%n%%B</commit_message>' %s\n\n", strings.Join(commitSHAs, " "))
		fmt.Fprint(buf, "Please run this EXACT command and follow their style when writing commit messages.\n")
	}

	return buf.String(), nil
}

// representativeCommitSHAs analyze recent commits and selects some representative ones.
func representativeCommitSHAs(ctx context.Context, repoRoot string) ([]string, error) {
	cmd := exec.Command("git", "log", "-n", "25", `--format=<commit_message hash="%H">%n%B</commit_message>`)
	cmd.Dir = repoRoot
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("git log failed: %w\n%s", err, out)
	}
	commits := strings.TrimSpace(string(out))
	if commits == "" {
		return nil, fmt.Errorf("no commits found in repository")
	}

	info := conversation.ToolCallInfoFromContext(ctx)
	sub := info.Convo.SubConvo()
	sub.PromptCaching = false

	sub.SystemPrompt = `You are an expert Git commit analyzer.

Your task is to analyze the provided commit messages and select the most representative examples that demonstrate this repository's commit style.

Identify consistent patterns in:
- Formatting conventions
- Language and tone
- Structure and organization
- Special notations or tags

Select up to 3 commit hashes that best exemplify the repository's commit style.

Provide ONLY the commit hashes, one per line. No additional text, formatting, or commentary.
`

	resp, err := sub.SendUserTextMessage(commits)
	if err != nil {
		return nil, fmt.Errorf("error from Claude: %w", err)
	}

	if len(resp.Content) != 1 {
		return nil, fmt.Errorf("unexpected response: %v", resp)
	}
	response := resp.Content[0].Text

	var result []string
	for line := range strings.Lines(response) {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if isHexString(line) && (len(line) >= 7 && len(line) <= 40) {
			result = append(result, line)
		}
	}

	result = result[:min(len(result), 3)]
	return result, nil
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
