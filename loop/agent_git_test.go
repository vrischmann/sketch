package loop

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// TestGitCommitTracking tests the git commit tracking functionality
func TestGitCommitTracking(t *testing.T) {
	// Create a temporary directory for our test git repo
	tempDir := t.TempDir() // Automatically cleaned up when the test completes

	// Initialize a git repo in the temp directory
	cmd := exec.Command("git", "init")
	cmd.Dir = tempDir
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to initialize git repo: %v", err)
	}

	// Configure git user for commits
	cmd = exec.Command("git", "config", "user.name", "Test User")
	cmd.Dir = tempDir
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to configure git user name: %v", err)
	}

	cmd = exec.Command("git", "config", "user.email", "test@example.com")
	cmd.Dir = tempDir
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to configure git user email: %v", err)
	}

	// Make an initial commit
	testFile := filepath.Join(tempDir, "test.txt")
	if err := os.WriteFile(testFile, []byte("initial content\n"), 0o644); err != nil {
		t.Fatalf("Failed to write file: %v", err)
	}

	cmd = exec.Command("git", "add", "test.txt")
	cmd.Dir = tempDir
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to add file: %v", err)
	}

	cmd = exec.Command("git", "commit", "-m", "Initial commit")
	cmd.Dir = tempDir
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to create initial commit: %v", err)
	}

	// Get the initial commit hash
	cmd = exec.Command("git", "rev-parse", "HEAD")
	cmd.Dir = tempDir
	initialCommitOutput, err := cmd.Output()
	if err != nil {
		t.Fatalf("Failed to get initial commit hash: %v", err)
	}
	initialCommit := strings.TrimSpace(string(initialCommitOutput))

	// Create agent with the temp repo
	agent := &Agent{
		workingDir:    tempDir,
		repoRoot:      tempDir, // Set repoRoot to same as workingDir for this test
		seenCommits:   make(map[string]bool),
		initialCommit: initialCommit,
	}

	// Make a new commit
	if err := os.WriteFile(testFile, []byte("updated content\n"), 0o644); err != nil {
		t.Fatalf("Failed to update file: %v", err)
	}

	cmd = exec.Command("git", "add", "test.txt")
	cmd.Dir = tempDir
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to add updated file: %v", err)
	}

	cmd = exec.Command("git", "commit", "-m", "Second commit\n\nThis commit has a multi-line message\nwith details about the changes.")
	cmd.Dir = tempDir
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to create second commit: %v", err)
	}

	// Call handleGitCommits and verify we get a commit message
	ctx := context.Background()
	_, err = agent.handleGitCommits(ctx)
	if err != nil {
		t.Fatalf("handleGitCommits failed: %v", err)
	}

	// Check if we received a commit message
	var commitMsg AgentMessage = agent.history[len(agent.history)-1]

	// Verify the commit message
	if commitMsg.Type != CommitMessageType {
		t.Errorf("Expected message type %s, got %s", CommitMessageType, commitMsg.Type)
	}

	if len(commitMsg.Commits) < 1 {
		t.Fatalf("Expected at least 1 commit, got %d", len(commitMsg.Commits))
	}

	// Find the second commit
	var commit *GitCommit
	found := false
	for _, c := range commitMsg.Commits {
		if strings.HasPrefix(c.Subject, "Second commit") {
			commit = c
			found = true
			break
		}
	}

	if !found {
		t.Fatalf("Could not find 'Second commit' in commits")
	}
	if !strings.HasPrefix(commit.Subject, "Second commit") {
		t.Errorf("Expected commit subject 'Second commit', got '%s'", commit.Subject)
	}

	if !strings.Contains(commit.Body, "multi-line message") {
		t.Errorf("Expected body to contain 'multi-line message', got '%s'", commit.Body)
	}

	// Test with many commits
	if testing.Short() {
		t.Skip("Skipping multiple commits test in short mode")
	}

	// Make multiple commits (more than 100)
	for i := 0; i < 110; i++ {
		newContent := []byte(fmt.Sprintf("content update %d\n", i))
		if err := os.WriteFile(testFile, newContent, 0o644); err != nil {
			t.Fatalf("Failed to update file: %v", err)
		}

		cmd = exec.Command("git", "add", "test.txt")
		cmd.Dir = tempDir
		if err := cmd.Run(); err != nil {
			t.Fatalf("Failed to add updated file: %v", err)
		}

		cmd = exec.Command("git", "commit", "-m", fmt.Sprintf("Commit %d", i+3))
		cmd.Dir = tempDir
		if err := cmd.Run(); err != nil {
			t.Fatalf("Failed to create commit %d: %v", i+3, err)
		}
	}

	// Reset the outbox channel and seen commits map
	agent.seenCommits = make(map[string]bool)

	// Call handleGitCommits again - it should still work but only show at most 100 commits
	_, err = agent.handleGitCommits(ctx)
	if err != nil {
		t.Fatalf("handleGitCommits failed: %v", err)
	}

	// Check if we received a commit message
	commitMsg = agent.history[len(agent.history)-1]

	// Should have at most 100 commits due to the -n 100 limit in git log
	if len(commitMsg.Commits) > 100 {
		t.Errorf("Expected at most 100 commits, got %d", len(commitMsg.Commits))
	}

	if len(commitMsg.Commits) < 50 {
		t.Errorf("Expected at least 50 commits, but only got %d", len(commitMsg.Commits))
	}

	t.Logf("Received %d commits out of 112 total", len(commitMsg.Commits))
}

// TestParseGitLog tests the parseGitLog function
func TestParseGitLog(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []GitCommit
	}{
		{
			name:     "Empty input",
			input:    "",
			expected: []GitCommit{},
		},
		{
			name:  "Single commit",
			input: "abcdef1234567890\x00Initial commit\x00This is the first commit\x00",
			expected: []GitCommit{
				{Hash: "abcdef1234567890", Subject: "Initial commit", Body: "This is the first commit"},
			},
		},
		{
			name: "Multiple commits",
			input: "abcdef1234567890\x00Initial commit\x00This is the first commit\x00" +
				"fedcba0987654321\x00Second commit\x00This is the second commit\x00" +
				"123456abcdef7890\x00Third commit\x00This is the third commit\x00",
			expected: []GitCommit{
				{Hash: "abcdef1234567890", Subject: "Initial commit", Body: "This is the first commit"},
				{Hash: "fedcba0987654321", Subject: "Second commit", Body: "This is the second commit"},
				{Hash: "123456abcdef7890", Subject: "Third commit", Body: "This is the third commit"},
			},
		},
		{
			name:  "Commit with multi-line body",
			input: "abcdef1234567890\x00Commit with multi-line body\x00This is a commit\nwith a multi-line\nbody message\x00",
			expected: []GitCommit{
				{Hash: "abcdef1234567890", Subject: "Commit with multi-line body", Body: "This is a commit\nwith a multi-line\nbody message"},
			},
		},
		{
			name:  "Commit with empty body",
			input: "abcdef1234567890\x00Commit with empty body\x00\x00",
			expected: []GitCommit{
				{Hash: "abcdef1234567890", Subject: "Commit with empty body", Body: ""},
			},
		},
		{
			name:  "Empty parts removed",
			input: "\x00abcdef1234567890\x00Initial commit\x00This is the first commit\x00\x00",
			expected: []GitCommit{
				{Hash: "abcdef1234567890", Subject: "Initial commit", Body: "This is the first commit"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := parseGitLog(tt.input)

			if len(actual) != len(tt.expected) {
				t.Fatalf("Expected %d commits, got %d", len(tt.expected), len(actual))
			}

			for i, commit := range actual {
				expected := tt.expected[i]
				if commit.Hash != expected.Hash || commit.Subject != expected.Subject || commit.Body != expected.Body {
					t.Errorf("Commit %d doesn't match:\nExpected: %+v\nGot:      %+v", i, expected, commit)
				}
			}
		})
	}
}
