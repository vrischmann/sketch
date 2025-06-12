package main

import (
	"flag"
	"fmt"
	"log"
	"os/exec"
	"path/filepath"

	"sketch.dev/webui"
)

func main() {
	dest := flag.String("dest", ".", "destination directory")
	flag.Parse()

	// Make sure that the webui is built so we can copy the results to the container.
	_, err := webui.Build()
	if err != nil {
		log.Fatal(err.Error())
	}

	webuiZipPath, err := webui.ZipPath()
	if err != nil {
		log.Fatal(err.Error())
	}
	cmd := exec.Command("cp", webuiZipPath, filepath.Join(*dest, "."))
	if err := cmd.Run(); err != nil {
		log.Fatal(err.Error())
	}

	fmt.Printf("webuiZipPath: %v copied to %s\n", webuiZipPath, *dest)
}
