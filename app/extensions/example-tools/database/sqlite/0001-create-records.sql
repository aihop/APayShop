CREATE TABLE IF NOT EXISTS `ext_example_tools_records` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `value` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
