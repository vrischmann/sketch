//go:build outie

package embedded

import (
	_ "embed"
	"io/fs"
)

//go:embed sketch-linux/sketch-linux-amd64
var sketchLinuxBinaryAmd64 []byte

//go:embed sketch-linux/sketch-linux-arm64
var sketchLinuxBinaryArm64 []byte

// LinuxBinary returns the embedded linux binary.
func LinuxBinary(arch string) []byte {
	switch arch {
	case "amd64", "x86_64":
		return sketchLinuxBinaryAmd64
	case "arm64", "aarch64":
		return sketchLinuxBinaryArm64
	}
	return nil
}

// WebUIFS returns the embedded webui filesystem.
func WebUIFS() fs.FS {
	// webUIAssets are not present in outie
	return nil
}
