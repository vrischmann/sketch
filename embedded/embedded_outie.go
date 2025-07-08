//go:build outie

package embedded

import (
	_ "embed"
	"io/fs"
)

//go:embed sketch-linux/sketch-linux
var sketchLinuxBinary []byte

// LinuxBinary returns the embedded linux binary.
func LinuxBinary() []byte {
	return sketchLinuxBinary
}

// WebUIFS returns the embedded webui filesystem.
func WebUIFS() fs.FS {
	// webUIAssets are not present in outie
	return nil
}
