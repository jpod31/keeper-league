#!/bin/bash
# Install to /usr/local/bin/vps-mem-report.sh (755), run hourly via /etc/cron.d/vps-mem-report.
#
# BinaryLane's alert reads (RAM used + swap used) / RAM total -- see their agent at
# /usr/local/bin/mpanel-memory-graph. That formula counts swap against RAM, so this
# 1GB box reports >100% while genuinely healthy. This records the same number plus
# the top consumers, so an alert can be explained from history instead of guessed at.
#
# Reports only. It deliberately never restarts anything -- an automatic restart could
# drop a live draft's websockets.
LOG=/var/log/vps-mem-report.log
total=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)
free_kb=$(awk '/^MemFree:/{print $2}' /proc/meminfo)
buffers=$(awk '/^Buffers:/{print $2}' /proc/meminfo)
cached=$(awk '/^Cached:/{print $2}' /proc/meminfo)
swtot=$(awk '/^SwapTotal:/{print $2}' /proc/meminfo)
swfree=$(awk '/^SwapFree:/{print $2}' /proc/meminfo)
swused=$((swtot - swfree))
used=$((total - free_kb - buffers - cached + swused))
pct=$((used * 100 / total))
top=$(ps -eo rss=,comm= --sort=-rss | head -3 | awk '{printf "%s=%dMB ", $2, $1/1024}')
printf "%s pct=%d%% ram_used=%dMB swap_used=%dMB | %s\n" \
    "$(date '+%Y-%m-%dT%H:%M:%S')" "$pct" "$(( (total-free_kb-buffers-cached)/1024 ))" "$((swused/1024))" "$top" >> "$LOG"

# Peak watch: on a 1GB box anything over 400MB RSS is what forces everything else
# out to swap. Log it loudly so the culprit is identifiable after the fact.
ps -eo rss=,pid=,comm= --sort=-rss | head -1 | while read -r rss pid comm; do
    if [ "$rss" -gt 409600 ]; then
        printf "%s WARN %s (pid %s) at %dMB RSS -- will force swap on a 1GB box\n" \
            "$(date '+%Y-%m-%dT%H:%M:%S')" "$comm" "$pid" "$((rss/1024))" >> "$LOG"
    fi
done
