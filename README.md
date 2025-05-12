# Sketch

Sketch is an agentic coding tool.

Sketch runs in your terminal, has a web UI, understands your code, and helps
you get work done. To keep your environment pristine, sketch starts a docker
container and outputs its work onto a branch in your host git repository.

Sketch helps with most programming environments, but Go is Sketch's specialty.

To get started:

```sh
go install sketch.dev/cmd/sketch@latest
sketch
```

## Requirements

Currently sketch runs on macOS and linux.
It uses docker for containers.

macOS: `brew install colima` (or an equivalent, like Docker Desktop or Orbstack)
linux: `apt install docker.io` (or equivalent for your distro)
WSL2:  install Docker Desktop for Windows (docker entirely inside WSL2 is tricky)

The [sketch.dev](https://sketch.dev) service is used to provide access
to an LLM service and give you a way to access the web UI from anywhere.

## Feedback/discussion

We have a discord server to discuss sketch.

Join if you want! https://discord.gg/6w9qNRUDzS

## User Guide

Start sketch by running `sketch` in a git repository. It will open your browser
to the Sketch chat interface, but you can also use the CLI interface. Use `-open=false`
if you want to use just the CLI interface.

Ask Sketch about your code base or ask Sketch to implement a feature. It may take
a little while for Sketch to do its work, so hit the bell (🔔) icon to enable
browser notifications. We won't spam you or anything; it will notify you
when the Sketch agent's turn is done, and there's something to look at.

### How Sketch Works

<!-- TODO: innie/outtie picture -->

When you start Sketch, it creates a Dockerfile, builds it, copies your
repository into it, and starts a Docker container, with the "inside" Sketch
running inside. This design let's you <b>run multiple sketches in parallel</b>
since they each have their own sandbox. It also lets Sketch work without worry:
it can trash its own container, but it can't trash your machine.

Sketch's agentic loop uses tool calls (mostly shell commands, but also a handful
of other important tools) to allow the LLM to interact with your code base.

### Getting Your Git Changes Out

<!-- TODO: git picture -->

Sketch is trained to make git commits. When those happen, they are
automatically pushed to the git repository where you started sketch with branch
names `sketch/*`. Use `git branch -a --sort=creatordate | grep sketch/ | tail`
to find them. The UI keeps track of the latest branch it pushed and displays it
prominently. You can use `git cherry-pick $(git merge-base origin/main
sketch/foo` or `git merge sketch/foo` or `git reset --hard sketch/foo` and so
on to pull those branches into your workspace. Use the same workflows you would
as if you were pulling in a friend's Pull Request.

You can ask Sketch to `git fetch sketch-host` and rebase onto some commit or
other. Doing so will also fetch where you started Sketch, and we do a bit of
"git fetch refspec configuration" to make `origin/main` work as a git reference.

Don't be afraid of asking Sketch to rebase, merge/squash commits, rewrite commit
messages, and so forth; it's good at it!

### Reviewing Diffs

The diff view shows you changes since Sketch started. Leaving comments on lines
adds them to the chat box, and, when you hit send, Sketch goes to work addressing your
comments.

### Connecting to Sketch's Container

You can interact directly with the container by:

 1. Using the "Terminal" tab in the UI
 2. Using `ssh`. Look at the startup logs or click on the information icon to see a command like `ssh sketch-ilik-eske-tcha-lott`.
We have automatically configured your SSH configuration to make these special hostnames work.
 3. Using Visual Studio Code. Again, look for a command line or magic link behind the information icon,
or when Sketch starts up. This starts a new VSCode session "remoted into" the container. You
can use the terminal, review diffs, and so forth.

By using SSH (and/or VSCode), you can forward ports from the container to your
machine. For example, if you want to start your development webserver, you can
do something like `ssh -L8000:localhost:8888 sketch-ilik-epor-tfor-ward go run
./cmd/server` to make `http://localhost:8000/` on your machine point to
`localhost:8888` inside the container.


### Using the Browser Tools

You can ask Sketch to browse a web page and take screenshots. There are tools
both for taking screenshots and "reading images," the latter of which sends the
image to the LLM. This functionality is handy if you're working on a web page and
want to see what the in-progress change looks like.

## FAQ

### `no space left on device`

Docker images, containers, and so forth tend to pile up. `docker prune -a` is a good
command to start with to prune unused images and containers.

## Development

[![Go Reference](https://pkg.go.dev/badge/sketch.dev.svg)](https://pkg.go.dev/sketch.dev)

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Open Source

Sketch is open source.
It is right here in this repository!
Have a look around and mod away.

If you want to run sketch entirely without the sketch.dev service, you can
set the flag -skaband-addr="" and then provide an `ANTHROPIC_API_KEY`
environment variable. (More LLM services coming soon!)
