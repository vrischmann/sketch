package ant

import (
	"math"
	"testing"
)

// TestCalculateCostFromTokens tests the calculateCostFromTokens function
func TestCalculateCostFromTokens(t *testing.T) {
	tests := []struct {
		name                     string
		model                    string
		inputTokens              uint64
		outputTokens             uint64
		cacheReadInputTokens     uint64
		cacheCreationInputTokens uint64
		want                     float64
	}{
		{
			name:                     "Zero tokens",
			model:                    Claude37Sonnet,
			inputTokens:              0,
			outputTokens:             0,
			cacheReadInputTokens:     0,
			cacheCreationInputTokens: 0,
			want:                     0,
		},
		{
			name:                     "1000 input tokens, 500 output tokens",
			model:                    Claude37Sonnet,
			inputTokens:              1000,
			outputTokens:             500,
			cacheReadInputTokens:     0,
			cacheCreationInputTokens: 0,
			want:                     0.0105,
		},
		{
			name:                     "10000 input tokens, 5000 output tokens",
			model:                    Claude37Sonnet,
			inputTokens:              10000,
			outputTokens:             5000,
			cacheReadInputTokens:     0,
			cacheCreationInputTokens: 0,
			want:                     0.105,
		},
		{
			name:                     "With cache read tokens",
			model:                    Claude37Sonnet,
			inputTokens:              1000,
			outputTokens:             500,
			cacheReadInputTokens:     2000,
			cacheCreationInputTokens: 0,
			want:                     0.0111,
		},
		{
			name:                     "With cache creation tokens",
			model:                    Claude37Sonnet,
			inputTokens:              1000,
			outputTokens:             500,
			cacheReadInputTokens:     0,
			cacheCreationInputTokens: 1500,
			want:                     0.016125,
		},
		{
			name:                     "With all token types",
			model:                    Claude37Sonnet,
			inputTokens:              1000,
			outputTokens:             500,
			cacheReadInputTokens:     2000,
			cacheCreationInputTokens: 1500,
			want:                     0.016725,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			usage := usage{
				InputTokens:              tt.inputTokens,
				OutputTokens:             tt.outputTokens,
				CacheReadInputTokens:     tt.cacheReadInputTokens,
				CacheCreationInputTokens: tt.cacheCreationInputTokens,
			}
			mr := response{
				Model: tt.model,
				Usage: usage,
			}
			totalCost := mr.TotalDollars()
			if math.Abs(totalCost-tt.want) > 0.0001 {
				t.Errorf("totalCost = %v, want %v", totalCost, tt.want)
			}
		})
	}
}
