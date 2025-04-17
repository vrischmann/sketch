package main

import (
	"fmt"
	"os/exec"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"
)

// verify that the following are installed on the host: docker colima npm
// TODO: check versions

func checkDocker() (string, error) {
	path, err := exec.LookPath("docker")
	if err != nil {
		return "", fmt.Errorf("cannot find `docker` binary; run: brew install docker colima && colima start")
	}
	cmd := exec.Command(path, "-v")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("docker version check failed: %w\n%s\n", err, string(output))
	}
	return fmt.Sprintf("%s %s", path, strings.TrimSpace(string(output))), nil
}

func checkColima() (string, error) {
	path, err := exec.LookPath("colima")
	if err != nil {
		return "", fmt.Errorf("cannot find `colima` binary; run: brew install docker colima && colima start")
	}
	cmd := exec.Command(path, "version")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("colima version check failed: %w\n%s\n", err, string(output))
	}
	return fmt.Sprintf("%s %s", path, strings.TrimSpace(string(output))), nil
}

func checkNPM() (string, error) {
	path, err := exec.LookPath("npm")
	if err != nil {
		return "", fmt.Errorf("cannot find `npm` binary; run: brew install npm")
	}
	cmd := exec.Command(path, "-version")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("npm version check failed: %w\n%s\n", err, string(output))
	}
	return fmt.Sprintf("%s %s", path, strings.TrimSpace(string(output))), nil
}

type reqCheckFunc func() (string, error)

func hostReqsCheck() ([]string, error) {
	var mu sync.Mutex
	ret := []string{}
	eg := errgroup.Group{}
	cfs := []reqCheckFunc{checkDocker, checkColima, checkNPM}
	eg.SetLimit(len(cfs))
	for _, f := range cfs {
		eg.Go(func() error {
			msg, err := f()
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				ret = append(ret, msg)
			} else {
				ret = append(ret, err.Error())
			}
			return err
		})
	}
	return ret, eg.Wait()
}
