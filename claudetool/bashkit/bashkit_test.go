package bashkit

import (
	"strings"
	"testing"
)

func TestCheck(t *testing.T) {
	tests := []struct {
		name     string
		script   string
		wantErr  bool
		errMatch string // string to match in error message, if wantErr is true
	}{
		{
			name:     "valid script",
			script:   "echo hello world",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "invalid syntax",
			script:   "echo 'unterminated string",
			wantErr:  false, // As per implementation, syntax errors are not flagged
			errMatch: "",
		},
		{
			name:     "git config user.name",
			script:   "git config user.name 'John Doe'",
			wantErr:  true,
			errMatch: "changing git config username/email is not allowed",
		},
		{
			name:     "git config user.email",
			script:   "git config user.email 'john@example.com'",
			wantErr:  true,
			errMatch: "changing git config username/email is not allowed",
		},
		{
			name:     "git config with flag user.name",
			script:   "git config --global user.name 'John Doe'",
			wantErr:  true,
			errMatch: "changing git config username/email is not allowed",
		},
		{
			name:     "git config with other setting",
			script:   "git config core.editor vim",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "git without config",
			script:   "git commit -m 'Add feature'",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "multiline script with proper escaped newlines",
			script:   "echo 'Setting up git...' && git config user.name 'John Doe' && echo 'Done!'",
			wantErr:  true,
			errMatch: "changing git config username/email is not allowed",
		},
		{
			name: "multiline script with backticks",
			script: `echo 'Setting up git...'
git config user.name 'John Doe'
echo 'Done!'`,
			wantErr:  true,
			errMatch: "changing git config username/email is not allowed",
		},
		{
			name:     "git config with variable",
			script:   "NAME='John Doe'\ngit config user.name $NAME",
			wantErr:  true,
			errMatch: "changing git config username/email is not allowed",
		},
		{
			name:     "only git command",
			script:   "git",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "read git config",
			script:   "git config user.name",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "commented git config",
			script:   "# git config user.name 'John Doe'",
			wantErr:  false,
			errMatch: "",
		},
		// Git add validation tests
		{
			name:     "git add with -A flag",
			script:   "git add -A",
			wantErr:  true,
			errMatch: "blind git add commands",
		},
		{
			name:     "git add with --all flag",
			script:   "git add --all",
			wantErr:  true,
			errMatch: "blind git add commands",
		},
		{
			name:     "git add with dot",
			script:   "git add .",
			wantErr:  true,
			errMatch: "blind git add commands",
		},
		{
			name:     "git add with asterisk",
			script:   "git add *",
			wantErr:  true,
			errMatch: "blind git add commands",
		},
		{
			name:     "git add with multiple flags including -A",
			script:   "git add -v -A",
			wantErr:  true,
			errMatch: "blind git add commands",
		},
		{
			name:     "git add with specific file",
			script:   "git add main.go",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "git add with multiple specific files",
			script:   "git add main.go utils.go",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "git add with directory path",
			script:   "git add src/main.go",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "git add with git flags before add",
			script:   "git -C /path/to/repo add -A",
			wantErr:  true,
			errMatch: "blind git add commands",
		},
		{
			name:     "git add with valid flags",
			script:   "git add -v main.go",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "git command without add",
			script:   "git status",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "multiline script with blind git add",
			script:   "echo 'Adding files' && git add -A && git commit -m 'Update'",
			wantErr:  true,
			errMatch: "blind git add commands",
		},
		{
			name:     "git add with pattern that looks like blind but is specific",
			script:   "git add file.A",
			wantErr:  false,
			errMatch: "",
		},
		{
			name:     "commented blind git add",
			script:   "# git add -A",
			wantErr:  false,
			errMatch: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := Check(tc.script)
			if (err != nil) != tc.wantErr {
				t.Errorf("Check() error = %v, wantErr %v", err, tc.wantErr)
				return
			}
			if tc.wantErr && err != nil && !strings.Contains(err.Error(), tc.errMatch) {
				t.Errorf("Check() error message = %v, want containing %v", err, tc.errMatch)
			}
		})
	}
}

func TestWillRunGitCommit(t *testing.T) {
	tests := []struct {
		name       string
		script     string
		wantCommit bool
	}{
		{
			name:       "simple git commit",
			script:     "git commit -m 'Add feature'",
			wantCommit: true,
		},
		{
			name:       "git command without commit",
			script:     "git status",
			wantCommit: false,
		},
		{
			name:       "multiline script with git commit",
			script:     "echo 'Making changes' && git add . && git commit -m 'Update files'",
			wantCommit: true,
		},
		{
			name:       "multiline script without git commit",
			script:     "echo 'Checking status' && git status",
			wantCommit: false,
		},
		{
			name:       "script with commented git commit",
			script:     "# git commit -m 'This is commented out'",
			wantCommit: false,
		},
		{
			name:       "git commit with variables",
			script:     "MSG='Fix bug' && git commit -m 'Using variable'",
			wantCommit: true,
		},
		{
			name:       "only git command",
			script:     "git",
			wantCommit: false,
		},
		{
			name:       "script with invalid syntax",
			script:     "git commit -m 'unterminated string",
			wantCommit: false,
		},
		{
			name:       "commit used in different context",
			script:     "echo 'commit message'",
			wantCommit: false,
		},
		{
			name:       "git with flags before commit",
			script:     "git -C /path/to/repo commit -m 'Update'",
			wantCommit: true,
		},
		{
			name:       "git with multiple flags",
			script:     "git --git-dir=.git -C repo commit -a -m 'Update'",
			wantCommit: true,
		},
		{
			name:       "git with env vars",
			script:     "GIT_AUTHOR_NAME=\"Josh Bleecher Snyder\" GIT_AUTHOR_EMAIL=\"josharian@gmail.com\" git commit -am \"Updated code\"",
			wantCommit: true,
		},
		{
			name:       "git with redirections",
			script:     "git commit -m 'Fix issue' > output.log 2>&1",
			wantCommit: true,
		},
		{
			name:       "git with piped commands",
			script:     "echo 'Committing' | git commit -F -",
			wantCommit: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotCommit, err := WillRunGitCommit(tc.script)
			if err != nil {
				t.Errorf("WillRunGitCommit() error = %v", err)
				return
			}
			if gotCommit != tc.wantCommit {
				t.Errorf("WillRunGitCommit() = %v, want %v", gotCommit, tc.wantCommit)
			}
		})
	}
}
