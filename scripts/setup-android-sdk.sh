#!/usr/bin/env bash
set -euo pipefail

sdk="$RUNNER_TEMP/sprit-android-sdk"
archive="$(mktemp --suffix=.zip)"
trap 'rm -f "$archive"' EXIT
curl --fail --location --silent --show-error --retry 3 \
  https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
  -o "$archive"
echo "2d2d50857e4eb553af5a6dc3ad507a17adf43d115264b1afc116f95c92e5e258  $archive" | sha256sum --check
mkdir -p "$sdk/cmdline-tools"
unzip -q "$archive" -d "$sdk/cmdline-tools"
mv "$sdk/cmdline-tools/cmdline-tools" "$sdk/cmdline-tools/latest"

manager="$sdk/cmdline-tools/latest/bin/sdkmanager"
# yes may exit with SIGPIPE once sdkmanager finishes reading.
( set +o pipefail; yes | "$manager" --sdk_root="$sdk" --licenses > /dev/null )
"$manager" --sdk_root="$sdk" platform-tools "$@"
printf 'ANDROID_HOME=%s\nANDROID_SDK_ROOT=%s\n' "$sdk" "$sdk" >> "$GITHUB_ENV"
printf '%s\n%s\n' "$sdk/cmdline-tools/latest/bin" "$sdk/platform-tools" >> "$GITHUB_PATH"
