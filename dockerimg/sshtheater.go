package dockerimg

import (
	"bufio"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kevinburke/ssh_config"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

const keyBitSize = 2048

// SSHTheater does the necessary key pair generation, known_hosts updates, ssh_config file updates etc steps
// so that ssh can connect to a locally running sketch container to other local processes like vscode without
// the user having to run the usual ssh obstacle course.
//
// SSHTheater does not modify your default .ssh/config, or known_hosts files.  However, in order for you
// to be able to use it properly you will have to make a one-time edit to your ~/.ssh/config file.
//
// In your ~/.ssh/config file, add the following line:
//
// Include $HOME/.sketch/ssh_config
//
// where $HOME is your home directory.
type SSHTheater struct {
	cntrName string
	sshHost  string
	sshPort  string

	knownHostsPath     string
	userIdentityPath   string
	sshConfigPath      string
	serverIdentityPath string

	serverPublicKey ssh.PublicKey
	serverIdentity  []byte
	userIdentity    []byte
}

// NewSSHTheather will set up everything so that you can use ssh on localhost to connect to
// the sketch container.  Call #Clean when you are done with the container to remove the
// various entries it created in its known_hosts and ssh_config files. Also note that
// this will generate key pairs for both the ssh server identity and the user identity, if
// these files do not already exist.  These key pair files are not deleted by #Cleanup,
// so they can be re-used across invocations of sketch. This means every sketch container
// that runs on this host will use the same ssh server identity.
//
// If this doesn't return an error, you should be able to run "ssh <cntrName>"
// in a terminal on your host machine to open a shell into the container without having
// to manually accept changes to your known_hosts file etc.
func NewSSHTheather(cntrName, sshHost, sshPort string) (*SSHTheater, error) {
	base := filepath.Join(os.Getenv("HOME"), ".sketch")
	if _, err := os.Stat(base); err != nil {
		if err := os.Mkdir(base, 0o777); err != nil {
			return nil, fmt.Errorf("couldn't create %s: %w", base, err)
		}
	}

	cst := &SSHTheater{
		cntrName:           cntrName,
		sshHost:            sshHost,
		sshPort:            sshPort,
		knownHostsPath:     filepath.Join(base, "known_hosts"),
		userIdentityPath:   filepath.Join(base, "container_user_identity"),
		serverIdentityPath: filepath.Join(base, "container_server_identity"),
		sshConfigPath:      filepath.Join(base, "ssh_config"),
	}
	if _, err := createKeyPairIfMissing(cst.serverIdentityPath); err != nil {
		return nil, fmt.Errorf("couldn't create server identity: %w", err)
	}
	if _, err := createKeyPairIfMissing(cst.userIdentityPath); err != nil {
		return nil, fmt.Errorf("couldn't create user identity: %w", err)
	}

	serverIdentity, err := os.ReadFile(cst.serverIdentityPath)
	if err != nil {
		return nil, fmt.Errorf("couldn't read container's ssh server identity: %w", err)
	}
	cst.serverIdentity = serverIdentity

	serverPubKeyBytes, err := os.ReadFile(cst.serverIdentityPath + ".pub")
	serverPubKey, _, _, _, err := ssh.ParseAuthorizedKey(serverPubKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("couldn't read ssh server public key: %w", err)
	}
	cst.serverPublicKey = serverPubKey

	userIdentity, err := os.ReadFile(cst.userIdentityPath + ".pub")
	if err != nil {
		return nil, fmt.Errorf("couldn't read ssh user identity: %w", err)
	}
	cst.userIdentity = userIdentity

	if err := cst.addContainerToSSHConfig(); err != nil {
		return nil, fmt.Errorf("couldn't add container to ssh_config: %w", err)
	}

	if err := cst.addContainerToKnownHosts(); err != nil {
		return nil, fmt.Errorf("couldn't update known hosts: %w", err)
	}

	return cst, nil
}

func removeFromHosts(cntrName string, cfgHosts []*ssh_config.Host) []*ssh_config.Host {
	hosts := []*ssh_config.Host{}
	for _, host := range cfgHosts {
		if host.Matches(cntrName) || strings.Contains(host.String(), cntrName) {
			continue
		}
		patMatch := false
		for _, pat := range host.Patterns {
			if strings.Contains(pat.String(), cntrName) {
				patMatch = true
			}
		}
		if patMatch {
			continue
		}

		hosts = append(hosts, host)
	}
	return hosts
}

func generatePrivateKey(bitSize int) (*rsa.PrivateKey, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, bitSize)
	if err != nil {
		return nil, err
	}
	return privateKey, nil
}

// generatePublicKey take a rsa.PublicKey and return bytes suitable for writing to .pub file
// returns in the format "ssh-rsa ..."
func generatePublicKey(privatekey *rsa.PublicKey) (ssh.PublicKey, error) {
	publicRsaKey, err := ssh.NewPublicKey(privatekey)
	if err != nil {
		return nil, err
	}

	return publicRsaKey, nil
}

func encodePrivateKeyToPEM(privateKey *rsa.PrivateKey) []byte {
	pemBlock := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	}
	pemBytes := pem.EncodeToMemory(pemBlock)
	return pemBytes
}

func writeKeyToFile(keyBytes []byte, filename string) error {
	err := os.WriteFile(filename, keyBytes, 0o600)
	return err
}

func createKeyPairIfMissing(idPath string) (ssh.PublicKey, error) {
	if _, err := os.Stat(idPath); err == nil {
		return nil, nil
	}

	privateKey, err := generatePrivateKey(keyBitSize)
	if err != nil {
		return nil, fmt.Errorf("Error generating private key: %w", err)
	}

	publicRsaKey, err := generatePublicKey(&privateKey.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("Error generating public key: %w", err)
	}

	privateKeyPEM := encodePrivateKeyToPEM(privateKey)

	err = writeKeyToFile(privateKeyPEM, idPath)
	if err != nil {
		return nil, fmt.Errorf("Error writing private key to file %w", err)
	}
	pubKeyBytes := ssh.MarshalAuthorizedKey(publicRsaKey)

	err = writeKeyToFile([]byte(pubKeyBytes), idPath+".pub")
	if err != nil {
		return nil, fmt.Errorf("Error writing public key to file %w", err)
	}
	return publicRsaKey, nil
}

func (c *SSHTheater) addSketchHostMatchIfMissing(cfg *ssh_config.Config) error {
	found := false
	for _, host := range cfg.Hosts {
		if strings.Contains(host.String(), "host=\"sketch-*\"") {
			found = true
			break
		}
	}
	if !found {
		hostPattern, err := ssh_config.NewPattern("host=\"sketch-*\"")
		if err != nil {
			return fmt.Errorf("couldn't add pattern to ssh_config: %w", err)
		}

		hostCfg := &ssh_config.Host{Patterns: []*ssh_config.Pattern{hostPattern}}
		hostCfg.Nodes = append(hostCfg.Nodes, &ssh_config.KV{Key: "UserKnownHostsFile", Value: c.knownHostsPath})

		hostCfg.Nodes = append(hostCfg.Nodes, &ssh_config.KV{Key: "IdentityFile", Value: c.userIdentityPath})
		hostCfg.Nodes = append(hostCfg.Nodes, &ssh_config.Empty{})

		cfg.Hosts = append([]*ssh_config.Host{hostCfg}, cfg.Hosts...)
	}
	return nil
}

func (c *SSHTheater) addContainerToSSHConfig() error {
	f, err := os.OpenFile(c.sshConfigPath, os.O_RDWR|os.O_CREATE, 0o644)
	if err != nil {
		return fmt.Errorf("couldn't open ssh_config: %w", err)
	}
	defer f.Close()

	cfg, err := ssh_config.Decode(f)
	if err != nil {
		return fmt.Errorf("couldn't decode ssh_config: %w", err)
	}
	cntrPattern, err := ssh_config.NewPattern(c.cntrName)
	if err != nil {
		return fmt.Errorf("couldn't add pattern to ssh_config: %w", err)
	}

	// Remove any matches for this container if they already exist.
	cfg.Hosts = removeFromHosts(c.cntrName, cfg.Hosts)

	hostCfg := &ssh_config.Host{Patterns: []*ssh_config.Pattern{cntrPattern}}
	hostCfg.Nodes = append(hostCfg.Nodes, &ssh_config.KV{Key: "HostName", Value: c.sshHost})
	hostCfg.Nodes = append(hostCfg.Nodes, &ssh_config.KV{Key: "User", Value: "root"})
	hostCfg.Nodes = append(hostCfg.Nodes, &ssh_config.KV{Key: "Port", Value: c.sshPort})
	hostCfg.Nodes = append(hostCfg.Nodes, &ssh_config.KV{Key: "IdentityFile", Value: c.userIdentityPath})
	hostCfg.Nodes = append(hostCfg.Nodes, &ssh_config.KV{Key: "UserKnownHostsFile", Value: c.knownHostsPath})

	hostCfg.Nodes = append(hostCfg.Nodes, &ssh_config.Empty{})
	cfg.Hosts = append(cfg.Hosts, hostCfg)

	if err := c.addSketchHostMatchIfMissing(cfg); err != nil {
		return fmt.Errorf("couldn't add missing host match: %w", err)
	}

	cfgBytes, err := cfg.MarshalText()
	if err != nil {
		return fmt.Errorf("couldn't marshal ssh_config: %w", err)
	}
	if err := f.Truncate(0); err != nil {
		return fmt.Errorf("couldn't truncate ssh_config: %w", err)
	}
	if _, err := f.Seek(0, 0); err != nil {
		return fmt.Errorf("couldn't seek to beginning of ssh_config: %w", err)
	}
	if _, err := f.Write(cfgBytes); err != nil {
		return fmt.Errorf("couldn't write ssh_config: %w", err)
	}

	return nil
}

func (c *SSHTheater) addContainerToKnownHosts() error {
	f, err := os.OpenFile(c.knownHostsPath, os.O_RDWR|os.O_CREATE, 0o644)
	if err != nil {
		return fmt.Errorf("couldn't open %s: %w", c.knownHostsPath, err)
	}
	defer f.Close()
	pkBytes := c.serverPublicKey.Marshal()
	if len(pkBytes) == 0 {
		return fmt.Errorf("empty serverPublicKey. This is a bug")
	}
	newHostLine := knownhosts.Line([]string{c.sshHost + ":" + c.sshPort}, c.serverPublicKey)

	outputLines := []string{}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		outputLines = append(outputLines, scanner.Text())
	}
	outputLines = append(outputLines, newHostLine)
	if err := f.Truncate(0); err != nil {
		return fmt.Errorf("couldn't truncate known_hosts: %w", err)
	}
	if _, err := f.Seek(0, 0); err != nil {
		return fmt.Errorf("couldn't seek to beginning of known_hosts: %w", err)
	}
	if _, err := f.Write([]byte(strings.Join(outputLines, "\n"))); err != nil {
		return fmt.Errorf("couldn't write updated known_hosts to to %s: %w", c.knownHostsPath, err)
	}

	return nil
}

func (c *SSHTheater) removeContainerFromKnownHosts() error {
	f, err := os.OpenFile(c.knownHostsPath, os.O_RDWR|os.O_CREATE, 0o644)
	if err != nil {
		return fmt.Errorf("couldn't open ssh_config: %w", err)
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	lineToRemove := knownhosts.Line([]string{c.sshHost + ":" + c.sshPort}, c.serverPublicKey)
	outputLines := []string{}
	for scanner.Scan() {
		if scanner.Text() == lineToRemove {
			continue
		}
		outputLines = append(outputLines, scanner.Text())
	}
	if err := f.Truncate(0); err != nil {
		return fmt.Errorf("couldn't truncate known_hosts: %w", err)
	}
	if _, err := f.Seek(0, 0); err != nil {
		return fmt.Errorf("couldn't seek to beginning of known_hosts: %w", err)
	}
	if _, err := f.Write([]byte(strings.Join(outputLines, "\n"))); err != nil {
		return fmt.Errorf("couldn't write updated known_hosts to to %s: %w", c.knownHostsPath, err)
	}

	return nil
}

func (c *SSHTheater) Cleanup() error {
	if err := c.removeContainerFromSSHConfig(); err != nil {
		return fmt.Errorf("couldn't remove container from ssh_config: %v\n", err)
	}
	if err := c.removeContainerFromKnownHosts(); err != nil {
		return fmt.Errorf("couldn't remove container from ssh_config: %v\n", err)
	}

	return nil
}

func (c *SSHTheater) removeContainerFromSSHConfig() error {
	f, err := os.OpenFile(c.sshConfigPath, os.O_RDWR|os.O_CREATE, 0o644)
	if err != nil {
		return fmt.Errorf("couldn't open ssh_config: %w", err)
	}
	defer f.Close()

	cfg, err := ssh_config.Decode(f)
	if err != nil {
		return fmt.Errorf("couldn't decode ssh_config: %w", err)
	}
	cfg.Hosts = removeFromHosts(c.cntrName, cfg.Hosts)

	if err := c.addSketchHostMatchIfMissing(cfg); err != nil {
		return fmt.Errorf("couldn't add missing host match: %w", err)
	}

	cfgBytes, err := cfg.MarshalText()
	if err != nil {
		return fmt.Errorf("couldn't marshal ssh_config: %w", err)
	}
	if err := f.Truncate(0); err != nil {
		return fmt.Errorf("couldn't truncate ssh_config: %w", err)
	}
	if _, err := f.Seek(0, 0); err != nil {
		return fmt.Errorf("couldn't seek to beginning of ssh_config: %w", err)
	}
	if _, err := f.Write(cfgBytes); err != nil {
		return fmt.Errorf("couldn't write ssh_config: %w", err)
	}
	return nil
}
