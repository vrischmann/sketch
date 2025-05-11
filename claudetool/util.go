package claudetool

import (
	"sketch.dev/llm"
)

// ContentToString extracts text from []llm.Content if available
func ContentToString(content []llm.Content) string {
	if len(content) == 0 {
		return ""
	}
	return content[0].Text
}
