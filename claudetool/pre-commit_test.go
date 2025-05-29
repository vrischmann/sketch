package claudetool

import (
	"testing"
)

func TestFilterGitTrailers(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name: "filters Co-authored-by",
			input: `<commit_message_style_example>
fix: update component

Some description.

Co-authored-by: user@example.com
</commit_message_style_example>`,
			expected: `<commit_message_style_example>
fix: update component

Some description.

</commit_message_style_example>`,
		},
		{
			name: "filters Co-Authored-By",
			input: `<commit_message_style_example>
feat: add feature

Co-Authored-By: another@example.com
</commit_message_style_example>`,
			expected: `<commit_message_style_example>
feat: add feature

</commit_message_style_example>`,
		},
		{
			name: "filters Change-ID",
			input: `<commit_message_style_example>
docs: update README

Change-ID: I123456789
</commit_message_style_example>`,
			expected: `<commit_message_style_example>
docs: update README

</commit_message_style_example>`,
		},
		{
			name: "filters Change-Id",
			input: `<commit_message_style_example>
style: format code

Change-Id: sc987654321
</commit_message_style_example>`,
			expected: `<commit_message_style_example>
style: format code

</commit_message_style_example>`,
		},
		{
			name: "preserves other content",
			input: `<commit_message_style_example>
fix: resolve issue

Some detailed explanation.
With multiple lines.
</commit_message_style_example>`,
			expected: `<commit_message_style_example>
fix: resolve issue

Some detailed explanation.
With multiple lines.
</commit_message_style_example>`,
		},
		{
			name: "filters multiple trailers",
			input: `<commit_message_style_example>
feat: new feature

Detailed description.

Co-authored-by: user1@example.com
Co-Authored-By: user2@example.com
Change-ID: I123
Change-Id: sc456
</commit_message_style_example>`,
			expected: `<commit_message_style_example>
feat: new feature

Detailed description.

</commit_message_style_example>`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := filterGitTrailers(tt.input)
			if result != tt.expected {
				t.Errorf("filterGitTrailers() = %q, want %q", result, tt.expected)
			}
		})
	}
}
