# Sketch Testing Itself

NOTE: This is an idea the Sketch developers are developing. We don't know if it works yet!

Sketch can test itself, but it can be a bit tricky, especially when Sketch
depends on Docker:

# Manual Steps

```
# Create a throwaway SSH key
ssh-keygen -t ed25519 -f ~/.ssh/sketch_test_key -P ""

# Create a VM for Sketch to run Docker in
limactl start --name=dockerhost --cpus=$(nproc) --memory=8 --plain --set='.ssh.localPort=2222' template://ubuntu

# Add the key to the VM
ssh -F "/Users/philip/.lima/dockerhost/ssh.config" lima-dockerhost tee -a .ssh/authorized_keys < /Users/philip/.ssh/sketch_test_key.pub
```

# What to tell Sketch

* Mount your key with "-mount $HOME/.ssh/sketch_test_key:/sketch_test_key"
* Configure DOCKER_HOST to host.docker.internal:2222 with the key above.
