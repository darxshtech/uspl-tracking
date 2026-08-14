-- ==============================================================================
-- UNITGLO SOLUTIONS - EMPLOYEE TRACKING SYSTEM
-- Complete Database Schema & Initial Data for cPanel MySQL / phpMyAdmin
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+05:30";

-- --------------------------------------------------------
-- 1. Table: users
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('Admin', 'CEO', 'PM', 'Developer', 'Tester') NOT NULL DEFAULT 'Developer',
  `phone` VARCHAR(50) DEFAULT NULL,
  `bio` TEXT DEFAULT NULL,
  `joining_date` DATE DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. Table: projects
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `projects` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `start_date` DATE DEFAULT NULL,
  `target_date` DATE DEFAULT NULL,
  `status` ENUM('Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled') NOT NULL DEFAULT 'In Progress',
  `documentation_url` TEXT DEFAULT NULL,
  `attachments` JSON DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. Table: project_members
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `project_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_proj_user` (`project_id`, `user_id`),
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 4. Table: tasks
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `assigned_to` INT DEFAULT NULL,
  `assigned_by_type` VARCHAR(50) DEFAULT 'Self Tested',
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `priority` ENUM('Low', 'Medium', 'High', 'Urgent') NOT NULL DEFAULT 'Medium',
  `due_date` DATE DEFAULT NULL,
  `target_date` DATE DEFAULT NULL,
  `status` ENUM('Planning', 'In Progress', 'Ready for Testing', 'Testing', 'Changes Required', 'Tested (PASS)', 'Ready for Demo', 'Completed') NOT NULL DEFAULT 'In Progress',
  `progress_percentage` INT DEFAULT 0,
  `hours_spent` DECIMAL(6,2) DEFAULT 0.00,
  `blockers` TEXT DEFAULT NULL,
  `daily_summary` TEXT DEFAULT NULL,
  `remarks` TEXT DEFAULT NULL,
  `task_link` TEXT DEFAULT NULL,
  `task_links` JSON DEFAULT NULL,
  `testing_started_at` TIMESTAMP NULL DEFAULT NULL,
  `testing_ended_at` TIMESTAMP NULL DEFAULT NULL,
  `issues_count` INT DEFAULT 0,
  `test_sheet_link` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 5. Table: attendance
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `login_time` VARCHAR(30) DEFAULT NULL,
  `logout_time` VARCHAR(30) DEFAULT NULL,
  `total_hours` DECIMAL(5,2) DEFAULT 0.00,
  `status` ENUM('Present', 'Half Day', 'Absent', 'Holiday', 'Leave', 'Present (Overtime)') NOT NULL DEFAULT 'Present',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_user_date` (`user_id`, `date`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 6. Table: holidays
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `holidays` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` DATE NOT NULL UNIQUE,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 7. Table: notifications
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `target_role` VARCHAR(50) DEFAULT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) DEFAULT 'info',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 8. Table: accomplishments
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `accomplishments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `hours_spent` DECIMAL(5,2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 9. Table: task_checklists
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `task_checklists` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `task_id` INT NOT NULL,
  `item_text` VARCHAR(500) NOT NULL,
  `is_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 10. Initial Seed Users
-- Passwords:
-- Admin: AdminPassword123!
-- CEO/PM/Dev/Tester: password123
-- --------------------------------------------------------
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `is_active`) VALUES
(1, 'Master Admin', 'admin@unitglo.com', '$2b$10$pe0eGfmMxfR9DvtRiY2tWe9gh1QjI3SvVYo4wOWSU2wOkhby6WoZe', 'Admin', 1),
(2, 'Chief Executive', 'ceo@unitglo.com', '$2b$10$z/KHUHVCrpNqLQ4SId08sOvsBMe3OZP1Q8pNJrY73iw62.vVJzlju', 'CEO', 1),
(3, 'Project Manager', 'pm@unitglo.com', '$2b$10$z/KHUHVCrpNqLQ4SId08sOvsBMe3OZP1Q8pNJrY73iw62.vVJzlju', 'PM', 1),
(4, 'Senior Developer', 'dev@unitglo.com', '$2b$10$z/KHUHVCrpNqLQ4SId08sOvsBMe3OZP1Q8pNJrY73iw62.vVJzlju', 'Developer', 1),
(5, 'QA Lead Tester', 'tester@unitglo.com', '$2b$10$z/KHUHVCrpNqLQ4SId08sOvsBMe3OZP1Q8pNJrY73iw62.vVJzlju', 'Tester', 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `password_hash`=VALUES(`password_hash`), `role`=VALUES(`role`);

SET FOREIGN_KEY_CHECKS = 1;
