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
