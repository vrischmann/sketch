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

def get_commit_info():
    """Extract commit information using git commands."""
    try:
        # Get commit message (subject line)
        commit_message = subprocess.check_output(
            ['git', 'log', '-1', '--pretty=format:%s'],
            text=True, stderr=subprocess.DEVNULL
        ).strip()

        # Get commit body (description)
        commit_body = subprocess.check_output(
            ['git', 'log', '-1', '--pretty=format:%b'],
            text=True, stderr=subprocess.DEVNULL
        ).strip()

        # Get commit author
        commit_author = subprocess.check_output(
            ['git', 'log', '-1', '--pretty=format:%an'],
            text=True, stderr=subprocess.DEVNULL
        ).strip()

        return commit_message, commit_body, commit_author
    except subprocess.CalledProcessError as e:
        print(f"Failed to get commit information: {e}")
        sys.exit(1)

def main():
    # Validate we're running in the correct environment
    validate_environment()

    # Check for test mode
    if os.environ.get('DISCORD_TEST_MODE') == '1':
        print("Running in test mode - will not send actual webhook")

    # Get commit information from git
    commit_message, commit_body, commit_author = get_commit_info()

    # Get remaining info from environment
    github_sha = os.environ.get('GITHUB_SHA')
    commit_sha = github_sha[:8]
    commit_url = f"https://github.com/{os.environ.get('GITHUB_REPOSITORY')}/commit/{github_sha}"

    # Create timestamp
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ')[:-3] + 'Z'

    # Create Discord webhook payload
    payload = {
        "embeds": [
            {
                "title": commit_message,
                "description": commit_body,
                "color": 5814783,
                "fields": [
                    {
                        "name": "Author",
                        "value": commit_author,
                        "inline": True
                    },
                    {
                        "name": "Commit",
                        "value": f"[{commit_sha}]({commit_url})",
                        "inline": True
                    },
                ],
                "timestamp": timestamp
            }
        ]
    }

    # Convert to JSON
    json_payload = json.dumps(payload)

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
                print("Discord notification sent successfully")
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
