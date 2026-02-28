#!/usr/bin/env Rscript
# fetch_stats.R — Fetch detailed player stats via fitzRoy and save as CSVs.
#
# Usage:
#   Rscript scripts/fetch_stats.R [start_year] [end_year]
#
# Defaults to 2013–2025 if no arguments given.
# Saves one CSV per year: data/player_stats_YYYY.csv
# Skips years that already have a CSV on disk (idempotent).
# Expects to be run from the project root, or via the Flask route (which sets cwd).

library(fitzRoy)

args <- commandArgs(trailingOnly = TRUE)
start_year <- ifelse(length(args) >= 1, as.integer(args[1]), 2013L)
end_year   <- ifelse(length(args) >= 2, as.integer(args[2]), as.integer(format(Sys.Date(), "%Y")))

# Resolve data directory: use cwd/data (Flask sets cwd to project root)
# or fall back to script location
get_data_dir <- function() {
  # Try cwd first
  cwd_data <- file.path(getwd(), "data")
  if (dir.exists(cwd_data)) return(cwd_data)

  # Try relative to this script
  cmd_args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("^--file=", cmd_args, value = TRUE)
  if (length(file_arg) > 0) {
    script_path <- normalizePath(sub("^--file=", "", file_arg[1]))
    project_data <- file.path(dirname(dirname(script_path)), "data")
    if (dir.exists(dirname(project_data))) {
      dir.create(project_data, showWarnings = FALSE, recursive = TRUE)
      return(project_data)
    }
  }

  # Last resort: cwd/data (create it)
  dir.create(cwd_data, showWarnings = FALSE, recursive = TRUE)
  return(cwd_data)
}

data_dir <- get_data_dir()

cat(sprintf("Fetching player stats for %d-%d\n", start_year, end_year))
cat(sprintf("Data directory: %s\n\n", normalizePath(data_dir, mustWork = FALSE)))

for (year in start_year:end_year) {
  csv_path <- file.path(data_dir, sprintf("player_stats_%d.csv", year))

  # Skip if CSV already exists on disk
  if (file.exists(csv_path)) {
    cat(sprintf("[SKIP] %d - already on disk: %s\n", year, basename(csv_path)))
    next
  }

  cat(sprintf("[FETCH] %d - trying footywire (has SC scores)... ", year))

  stats <- tryCatch({
    fetch_player_stats(season = year, source = "footywire")
  }, error = function(e) {
    cat(sprintf("footywire failed (%s), trying fryzigg... ", conditionMessage(e)))
    tryCatch({
      fetch_player_stats(season = year, source = "fryzigg")
    }, error = function(e2) {
      cat(sprintf("fryzigg failed (%s), trying AFL... ", conditionMessage(e2)))
      tryCatch({
        fetch_player_stats(season = year, source = "AFL")
      }, error = function(e3) {
        NULL
      })
    })
  })

  if (is.null(stats) || nrow(stats) == 0) {
    cat(sprintf("NO DATA for %d - skipping.\n", year))
    next
  }

  write.csv(stats, csv_path, row.names = FALSE)
  cat(sprintf("OK - %d rows, %d columns -> %s\n", nrow(stats), ncol(stats), basename(csv_path)))
}

cat("\nDone.\n")
