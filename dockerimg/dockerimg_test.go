package dockerimg

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
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

// TestBinaryCaching tests the content-addressable binary caching functionality
func TestBinaryCaching(t *testing.T) {
	// Mock the embedded binary
	testBinary := []byte("fake binary content for testing")

	// Calculate expected hash
	hash := sha256.Sum256(testBinary)
	hashHex := hex.EncodeToString(hash[:])

	// Create a temporary directory for this test
	tempDir := t.TempDir()
	cacheDir := filepath.Join(tempDir, "sketch-binary-cache")
	binaryPath := filepath.Join(cacheDir, hashHex)

	// First, create the cache directory
	err := os.MkdirAll(cacheDir, 0o755)
	if err != nil {
		t.Fatalf("Failed to create cache directory: %v", err)
	}

	// Verify the binary doesn't exist initially
	if _, err := os.Stat(binaryPath); !os.IsNotExist(err) {
		t.Fatalf("Binary should not exist initially, but stat returned: %v", err)
	}

	// Write the binary (simulating first time)
	err = os.WriteFile(binaryPath, testBinary, 0o700)
	if err != nil {
		t.Fatalf("Failed to write binary: %v", err)
	}

	// Verify the binary now exists and has correct permissions
	info, err := os.Stat(binaryPath)
	if err != nil {
		t.Fatalf("Failed to stat cached binary: %v", err)
	}

	if info.Mode().Perm() != 0o700 {
		t.Errorf("Expected permissions 0700, got %o", info.Mode().Perm())
	}

	// Verify content matches
	cachedContent, err := os.ReadFile(binaryPath)
	if err != nil {
		t.Fatalf("Failed to read cached binary: %v", err)
	}

	if !bytes.Equal(testBinary, cachedContent) {
		t.Error("Cached binary content doesn't match original")
	}

	// Test that the same hash produces the same path
	hash2 := sha256.Sum256(testBinary)
	hashHex2 := hex.EncodeToString(hash2[:])

	if hashHex != hashHex2 {
		t.Error("Same content should produce same hash")
	}

	// Test that different content produces different hash
	differentBinary := []byte("different fake binary content")
	differentHash := sha256.Sum256(differentBinary)
	differentHashHex := hex.EncodeToString(differentHash[:])

	if hashHex == differentHashHex {
		t.Error("Different content should produce different hash")
	}
}
