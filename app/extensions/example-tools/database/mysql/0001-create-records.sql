CREATE TABLE IF NOT EXISTS `ext_example_tools_records` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `value` text NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
