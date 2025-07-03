package dockerimg

import (
	"context"
	"os"
	"testing"
)

// TestDockerHashIsPushed tests that the published image hash is available
func TestDockerHashIsPushed(t *testing.T) {
	// Skip this test if we can't reach the internet
	if os.Getenv("CI") == "" {
		t.Skip("Skipping test that requires internet access")
	}

	if err := checkTagExists(dockerfileBaseHash()); err != nil {
		t.Errorf("Docker image tag %s not found: %v", dockerfileBaseHash(), err)
	}

	// Test that the default image components are reasonable
	name, dockerfile, tag := DefaultImage()
	if name == "" {
		t.Error("DefaultImage name is empty")
	}
	if dockerfile == "" {
		t.Error("DefaultImage dockerfile is empty")
	}
	if tag == "" {
		t.Error("DefaultImage tag is empty")
	}
	if len(tag) < 10 {
		t.Errorf("DefaultImage tag suspiciously short: %s", tag)
	}
}

// TestGetHostGoCacheDirs tests that we can get the host Go cache directories
func TestGetHostGoCacheDirs(t *testing.T) {
	if !RaceEnabled() {
		t.Skip("Race detector not enabled, skipping test")
	}

	ctx := context.Background()

	goCacheDir, err := getHostGoCacheDir(ctx)
	if err != nil {
		t.Fatalf("getHostGoCacheDir failed: %v", err)
	}
	if goCacheDir == "" {
		t.Error("GOCACHE is empty")
	}

	goModCacheDir, err := getHostGoModCacheDir(ctx)
	if err != nil {
		t.Fatalf("getHostGoModCacheDir failed: %v", err)
	}
	if goModCacheDir == "" {
		t.Error("GOMODCACHE is empty")
	}

	t.Logf("GOCACHE: %s", goCacheDir)
	t.Logf("GOMODCACHE: %s", goModCacheDir)
}

// TestCreateCacheKey tests the cache key generation
func TestCreateCacheKey(t *testing.T) {
	key1 := createCacheKey("image1", "/path1")
	key2 := createCacheKey("image2", "/path1")
	key3 := createCacheKey("image1", "/path2")
	key4 := createCacheKey("image1", "/path1")

	// Different inputs should produce different keys
	if key1 == key2 {
		t.Error("Different base images should produce different cache keys")
	}
	if key1 == key3 {
		t.Error("Different paths should produce different cache keys")
	}

	// Same inputs should produce same key
	if key1 != key4 {
		t.Error("Same inputs should produce same cache key")
	}

	// Keys should be reasonably short
	if len(key1) != 12 {
		t.Errorf("Cache key length should be 12, got %d", len(key1))
	}
}

// TestEnsureBaseImageExists tests the base image existence check and pull logic
func TestEnsureBaseImageExists(t *testing.T) {
	// This test would require Docker to be running and would make network calls
	// So we'll skip it unless we're in an integration test environment
	if testing.Short() {
		t.Skip("Skipping integration test that requires Docker")
	}

	ctx := context.Background()

	// Test with a non-existent image (should fail gracefully)
	err := ensureBaseImageExists(ctx, "nonexistent/image:tag")
	if err == nil {
		t.Error("Expected error for nonexistent image, got nil")
	}
}
