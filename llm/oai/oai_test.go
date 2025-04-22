package oai

import (
	"math"
	"testing"

	"sketch.dev/llm"
)

// TestCalculateCostFromTokens tests the calculateCostFromTokens method
func TestCalculateCostFromTokens(t *testing.T) {
	tests := []struct {
		name                string
		model               Model
		cacheCreationTokens uint64
		cacheReadTokens     uint64
		outputTokens        uint64
		want                float64
	}{
		{
			name:                "Zero tokens",
			model:               GPT41,
			cacheCreationTokens: 0,
			cacheReadTokens:     0,
			outputTokens:        0,
			want:                0,
		},
		{
			name:                "1000 input tokens, 500 output tokens",
			model:               GPT41,
			cacheCreationTokens: 1000,
			cacheReadTokens:     0,
			outputTokens:        500,
			// GPT41: Input: 200 per million, Output: 800 per million
			// (1000 * 200 + 500 * 800) / 1_000_000 / 100 = 0.006
			want: 0.006,
		},
		{
			name:                "10000 input tokens, 5000 output tokens",
			model:               GPT41,
			cacheCreationTokens: 10000,
			cacheReadTokens:     0,
			outputTokens:        5000,
			// (10000 * 200 + 5000 * 800) / 1_000_000 / 100 = 0.06
			want: 0.06,
		},
		{
			name:                "1000 input tokens, 500 output tokens Gemini",
			model:               Gemini25Flash,
			cacheCreationTokens: 1000,
			cacheReadTokens:     0,
			outputTokens:        500,
			// Gemini25Flash: Input: 15 per million, Output: 60 per million
			// (1000 * 15 + 500 * 60) / 1_000_000 / 100 = 0.00045
			want: 0.00045,
		},
		{
			name:                "With cache read tokens",
			model:               GPT41,
			cacheCreationTokens: 500,
			cacheReadTokens:     500, // 500 tokens from cache
			outputTokens:        500,
			// (500 * 200 + 500 * 50 + 500 * 800) / 1_000_000 / 100 = 0.00525
			want: 0.00525,
		},
		{
			name:                "With all token types",
			model:               GPT41,
			cacheCreationTokens: 1000,
			cacheReadTokens:     1000,
			outputTokens:        1000,
			// (1000 * 200 + 1000 * 50 + 1000 * 800) / 1_000_000 / 100 = 0.0105
			want: 0.0105,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a service with the test model
			svc := &Service{Model: tt.model}

			// Create a usage object
			usage := llm.Usage{
				CacheCreationInputTokens: tt.cacheCreationTokens,
				CacheReadInputTokens:     tt.cacheReadTokens,
				OutputTokens:             tt.outputTokens,
			}

			totalCost := svc.calculateCostFromTokens(usage)
			if math.Abs(totalCost-tt.want) > 0.0001 {
				t.Errorf("calculateCostFromTokens(%s, cache_creation=%d, cache_read=%d, output=%d) = %v, want %v",
					tt.model.ModelName, tt.cacheCreationTokens, tt.cacheReadTokens, tt.outputTokens, totalCost, tt.want)
			}
		})
	}
}
