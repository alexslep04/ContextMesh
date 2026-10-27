import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

DEFAULT_OUTPUT = Path(__file__).with_name("repo_context.json")
REPOSITORY_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def repository_name(value):
    if not REPOSITORY_PATTERN.fullmatch(value):
        raise argparse.ArgumentTypeError("repository must use the owner/name format")
    return value


def positive_interval(value):
    try:
        interval = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("interval must be a positive integer") from error
    if interval <= 0:
        raise argparse.ArgumentTypeError("interval must be a positive integer")
    return interval


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Watch a public GitHub repository and save its latest commit context."
    )
    parser.add_argument(
        "--repo",
        required=True,
        type=repository_name,
        metavar="OWNER/NAME",
        help="public GitHub repository to monitor",
    )
    parser.add_argument("--branch", default="main", help="branch to monitor (default: main)")
    parser.add_argument(
        "--interval",
        default=120,
        type=positive_interval,
        metavar="SECONDS",
        help="polling interval in seconds (default: 120)",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        type=Path,
        metavar="PATH",
        help=f"snapshot destination (default: {DEFAULT_OUTPUT})",
    )
    return parser.parse_args(argv)


def fetch_latest_commit(owner, repository, branch_name):
    branch = quote(branch_name, safe="")
    url = f"https://api.github.com/repos/{owner}/{repository}/commits/{branch}"
    request = Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "bridge",
        },
    )

    with urlopen(request, timeout=20) as response:
        return json.load(response)


def save_context(commit, repository_name, branch_name, output):
    context = {
        "repository": repository_name,
        "branch": branch_name,
        "commit_sha": commit["sha"],
        "commit_message": commit["commit"]["message"],
        "commit_url": commit["html_url"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "changed_files": [
            {
                "path": file["filename"],
                "status": file["status"],
                "patch": file.get("patch"),
            }
            for file in commit.get("files", [])
        ],
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(context, indent=2),
        encoding="utf-8",
    )
    return context


def main(argv=None):
    args = parse_args(argv)
    owner, repository = args.repo.split("/", 1)
    previous_sha = None
    print(f"Watching {args.repo}, branch {args.branch}")
    print("Keep this terminal open. Press Ctrl+C to stop.")

    while True:
        try:
            commit = fetch_latest_commit(owner, repository, args.branch)

            if commit["sha"] != previous_sha:
                context = save_context(commit, args.repo, args.branch, args.output)

                label = (
                    "Initial snapshot saved"
                    if previous_sha is None
                    else "Repository update detected"
                )
                print(f"\n{label}: {context['commit_sha'][:7]}")
                print(context["commit_message"])
                for file in context["changed_files"]:
                    print(f"  {file['status']}: {file['path']}")
                print(f"Context saved to {args.output}")

                previous_sha = commit["sha"]
            else:
                print("No new commit.")

        except HTTPError as error:
            print(f"GitHub returned HTTP {error.code}.")
            if error.code in (403, 429):
                print("Access or rate-limit issue. Stop and check before retrying.")
                break
            if error.code == 404:
                print("Check the username, repository, branch, and public visibility.")
                break
        except (URLError, TimeoutError) as error:
            print(f"Connection problem: {error}")

        time.sleep(args.interval)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nWatcher stopped.")
