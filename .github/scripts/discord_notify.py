#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone

def validate_environment():
    """Validate required environment variables."""
    if not os.environ.get('GITHUB_SHA'):
        print("Error: GITHUB_SHA environment variable is required")
        sys.exit(1)

    if not os.environ.get('GITHUB_REPOSITORY'):
        print("Error: GITHUB_REPOSITORY environment variable is required")
        sys.exit(1)

    if not os.environ.get('DISCORD_WEBHOOK_FOR_COMMITS'):
        print("Error: DISCORD_WEBHOOK_FOR_COMMITS environment variable is required")
        sys.exit(1)

def get_commit_range():
    """Get the range of commits from the GitHub event payload."""
    event_path = os.environ.get('GITHUB_EVENT_PATH')
    if not event_path:
        print("Warning: GITHUB_EVENT_PATH not available, falling back to single commit")
        return None, None
    
    try:
        with open(event_path, 'r') as f:
            event_data = json.load(f)
        
        before = event_data.get('before')
        after = event_data.get('after')
        
        # GitHub sends '0000000000000000000000000000000000000000' for new branches
        if before and before != '0000000000000000000000000000000000000000':
            return before, after
        else:
            return None, None
    except (FileNotFoundError, json.JSONDecodeError, KeyError) as e:
        print(f"Warning: Could not parse GitHub event payload: {e}")
        return None, None

def get_commit_info(commit_sha=None):
    """Extract commit information using git commands."""
    commit_ref = commit_sha or 'HEAD'
    try:
        # Get commit message (subject line)
        commit_message = subprocess.check_output(
            ['git', 'log', '-1', '--pretty=format:%s', commit_ref],
            text=True, stderr=subprocess.DEVNULL
        ).strip()

        # Get commit body (description)
        commit_body = subprocess.check_output(
            ['git', 'log', '-1', '--pretty=format:%b', commit_ref],
            text=True, stderr=subprocess.DEVNULL
        ).strip()

        # Get commit author
        commit_author = subprocess.check_output(
            ['git', 'log', '-1', '--pretty=format:%an', commit_ref],
            text=True, stderr=subprocess.DEVNULL
        ).strip()

        return commit_message, commit_body, commit_author
    except subprocess.CalledProcessError as e:
        print(f"Failed to get commit information: {e}")
        sys.exit(1)

def get_commits_in_range(before, after):
    """Get all commits in the range before..after."""
    try:
        # Get commit SHAs in the range
        commit_shas = subprocess.check_output(
            ['git', 'rev-list', '--reverse', f'{before}..{after}'],
            text=True, stderr=subprocess.DEVNULL
        ).strip().split('\n')
        
        # Filter out empty strings
        commit_shas = [sha for sha in commit_shas if sha]
        
        commits = []
        for sha in commit_shas:
            message, body, author = get_commit_info(sha)
            commits.append({
                'sha': sha,
                'short_sha': sha[:8],
                'message': message,
                'body': body,
                'author': author
            })
        
        return commits
    except subprocess.CalledProcessError as e:
        print(f"Failed to get commits in range: {e}")
        sys.exit(1)

def truncate_text(text, max_length):
    """Truncate text to fit within Discord's limits."""
    if len(text) <= max_length:
        return text
    # Find a good place to cut off, preferably at a sentence or paragraph boundary
    truncated = text[:max_length - 3]  # Leave room for "..."
    
    # Try to cut at paragraph boundary
    last_double_newline = truncated.rfind('\n\n')
    if last_double_newline > max_length // 2:  # Only if we're not cutting too much
        return truncated[:last_double_newline] + "\n\n..."
    
    # Try to cut at sentence boundary
    last_period = truncated.rfind('. ')
    if last_period > max_length // 2:  # Only if we're not cutting too much
        return truncated[:last_period + 1] + " ..."
    
    # Otherwise just truncate with ellipsis
    return truncated + "..."

def format_commit_for_discord(commit, repo_name):
    """Format a single commit for Discord display."""
    commit_url = f"https://github.com/{repo_name}/commit/{commit['sha']}"
    return f"[`{commit['short_sha']}`]({commit_url}) {commit['message']} - {commit['author']}"

def create_discord_payload_for_commits(commits, repo_name):
    """Create Discord payload for multiple commits."""
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ')[:-3] + 'Z'
    
    if len(commits) == 1:
        # Single commit - use the original detailed format
        commit = commits[0]
        commit_url = f"https://github.com/{repo_name}/commit/{commit['sha']}"
        title = truncate_text(commit['message'], 256)
        description = truncate_text(commit['body'], 2000)
        
        return {
            "embeds": [
                {
                    "title": title,
                    "description": description,
                    "color": 5814783,
                    "fields": [
                        {
                            "name": "Author",
                            "value": commit['author'],
                            "inline": True
                        },
                        {
                            "name": "Commit",
                            "value": f"[{commit['short_sha']}]({commit_url})",
                            "inline": True
                        },
                    ],
                    "timestamp": timestamp
                }
            ]
        }
    else:
        # Multiple commits - use a compact format
        commit_lines = []
        for commit in commits:
            commit_lines.append(format_commit_for_discord(commit, repo_name))
        
        description = "\n".join(commit_lines)
        
        # Truncate if too long
        if len(description) > 2000:
            # Try to fit as many commits as possible
            truncated_lines = []
            current_length = 0
            for line in commit_lines:
                if current_length + len(line) + 1 > 1900:  # Leave room for "...and X more"
                    remaining = len(commit_lines) - len(truncated_lines)
                    truncated_lines.append(f"...and {remaining} more commits")
                    break
                truncated_lines.append(line)
                current_length += len(line) + 1
            description = "\n".join(truncated_lines)
        
        # Get unique authors
        authors = list(set(commit['author'] for commit in commits))
        author_text = ", ".join(authors) if len(authors) <= 3 else f"{authors[0]} and {len(authors) - 1} others"
        
        return {
            "embeds": [
                {
                    "title": f"{len(commits)} commits pushed to main",
                    "description": description,
                    "color": 5814783,
                    "fields": [
                        {
                            "name": "Authors",
                            "value": author_text,
                            "inline": True
                        },
                        {
                            "name": "Commits",
                            "value": str(len(commits)),
                            "inline": True
                        },
                    ],
                    "timestamp": timestamp
                }
            ]
        }

def main():
    # Validate we're running in the correct environment
    validate_environment()

    # Check for test mode
    if os.environ.get('DISCORD_TEST_MODE') == '1':
        print("Running in test mode - will not send actual webhook")

    # Get repository info
    repo_name = os.environ.get('GITHUB_REPOSITORY')
    
    # Try to get commit range from GitHub event
    before, after = get_commit_range()
    
    if before and after:
        # Multiple commits pushed
        commits = get_commits_in_range(before, after)
        if not commits:
            print("No commits found in range, falling back to single commit")
            # Fall back to single commit
            commit_message, commit_body, commit_author = get_commit_info()
            github_sha = os.environ.get('GITHUB_SHA')
            commits = [{
                'sha': github_sha,
                'short_sha': github_sha[:8],
                'message': commit_message,
                'body': commit_body,
                'author': commit_author
            }]
    else:
        # Single commit or fallback
        commit_message, commit_body, commit_author = get_commit_info()
        github_sha = os.environ.get('GITHUB_SHA')
        commits = [{
            'sha': github_sha,
            'short_sha': github_sha[:8],
            'message': commit_message,
            'body': commit_body,
            'author': commit_author
        }]
    
    # Create Discord webhook payload
    payload = create_discord_payload_for_commits(commits, repo_name)

    # Convert to JSON
    json_payload = json.dumps(payload)
    
    # Debug: print payload size info
    if os.environ.get('DISCORD_TEST_MODE') == '1':
        print(f"Payload size: {len(json_payload)} bytes")
        print(f"Title length: {len(payload['embeds'][0]['title'])} chars")
        print(f"Description length: {len(payload['embeds'][0]['description'])} chars")
        print(f"Number of commits: {len(commits)}")

    # Test mode - just print the payload
    if os.environ.get('DISCORD_TEST_MODE') == '1':
        print("Generated Discord payload:")
        print(json.dumps(payload, indent=2))
        print("✓ Test mode: payload generated successfully")
        return

    # Send to Discord webhook
    webhook_url = os.environ.get('DISCORD_WEBHOOK_FOR_COMMITS')

    req = urllib.request.Request(
        webhook_url,
        data=json_payload.encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'sketch.dev developers'
        }
    )

    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 204:
                print(f"Discord notification sent successfully for {len(commits)} commit(s)")
            else:
                print(f"Discord webhook returned status: {response.status}")
                response_body = response.read().decode('utf-8')
                print(f"Response body: {response_body}")
                sys.exit(1)
    except urllib.error.HTTPError as e:
        print(f"Discord webhook HTTP error: {e.code} - {e.reason}")
        try:
            error_body = e.read().decode('utf-8')
            print(f"Error details: {error_body}")
            if e.code == 403 and 'error code: 1010' in error_body:
                print("Error 1010: Webhook not found - the Discord webhook URL may be invalid or expired")
        except:
            pass
        sys.exit(1)
    except Exception as e:
        print(f"Failed to send Discord notification: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
