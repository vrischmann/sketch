//go:build !linux

package main

import "context"

func startReaper(_ context.Context) error {
	return nil
}
