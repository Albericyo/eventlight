-- EventFlow — schéma initial (BDD dédiée)
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) DEFAULT NULL,
  contact_phone VARCHAR(40) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ef_projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  client VARCHAR(120) DEFAULT NULL,
  venue VARCHAR(200) DEFAULT NULL,
  event_date DATE DEFAULT NULL,
  status ENUM('draft','confirmed','archived') DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ef_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_ef_projects_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ef_device_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  manufacturer VARCHAR(80) DEFAULT NULL,
  category ENUM('audio','light','network','power','fx','custom') DEFAULT 'custom',
  rack_u TINYINT(1) NOT NULL DEFAULT 1,
  rack_width ENUM('full','half','third') DEFAULT 'full',
  weight_kg DECIMAL(5,2) DEFAULT NULL,
  power_w SMALLINT DEFAULT 0,
  depth_mm SMALLINT DEFAULT NULL,
  panel_front_svg MEDIUMTEXT,
  panel_rear_svg MEDIUMTEXT,
  panel_front_ports JSON DEFAULT NULL,
  panel_rear_ports JSON DEFAULT NULL,
  notes TEXT,
  is_public TINYINT(1) DEFAULT 0,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ef_device_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_ef_device_public (is_public),
  KEY idx_ef_device_created (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ef_rack_instances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  size_u TINYINT NOT NULL DEFAULT 12,
  rack_type ENUM('open','flight','wall') DEFAULT 'flight',
  location VARCHAR(80) DEFAULT NULL,
  sort_order SMALLINT DEFAULT 0,
  notes TEXT,
  CONSTRAINT fk_ef_rack_project FOREIGN KEY (project_id) REFERENCES ef_projects(id) ON DELETE CASCADE,
  KEY idx_ef_rack_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ef_rack_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rack_id INT NOT NULL,
  device_template_id INT NOT NULL,
  slot_u TINYINT NOT NULL,
  slot_col TINYINT DEFAULT 0,
  custom_name VARCHAR(120) DEFAULT NULL,
  custom_notes TEXT,
  color_hex CHAR(7) DEFAULT NULL,
  port_labels JSON DEFAULT NULL,
  CONSTRAINT fk_ef_slot_rack FOREIGN KEY (rack_id) REFERENCES ef_rack_instances(id) ON DELETE CASCADE,
  CONSTRAINT fk_ef_slot_device FOREIGN KEY (device_template_id) REFERENCES ef_device_templates(id),
  UNIQUE KEY uq_slot (rack_id, slot_u, slot_col),
  KEY idx_ef_slot_rack (rack_id),
  KEY idx_ef_slot_device (device_template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ef_connections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  src_slot_id INT NOT NULL,
  src_port_id VARCHAR(20) NOT NULL,
  dst_slot_id INT NOT NULL,
  dst_port_id VARCHAR(20) NOT NULL,
  cable_type ENUM('xlr3','xlr5','rj45','speakon','jack','bnc','dmx','power','fiber','other') DEFAULT 'other',
  cable_length_m DECIMAL(5,1) DEFAULT NULL,
  cable_label VARCHAR(80) DEFAULT NULL,
  signal_type ENUM('audio_analog','audio_digital','dmx','ethernet','power','video','other') DEFAULT 'other',
  notes TEXT,
  CONSTRAINT fk_ef_conn_project FOREIGN KEY (project_id) REFERENCES ef_projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_ef_conn_src FOREIGN KEY (src_slot_id) REFERENCES ef_rack_slots(id) ON DELETE CASCADE,
  CONSTRAINT fk_ef_conn_dst FOREIGN KEY (dst_slot_id) REFERENCES ef_rack_slots(id) ON DELETE CASCADE,
  KEY idx_ef_conn_project (project_id),
  KEY idx_ef_conn_signal (signal_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ef_project_racks_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  rack_a_id INT NOT NULL,
  rack_b_id INT NOT NULL,
  link_type ENUM('ethernet','audio_snake','dmx_snake','power','multicore','other') DEFAULT 'other',
  cable_length_m DECIMAL(6,1) DEFAULT NULL,
  notes TEXT,
  CONSTRAINT fk_ef_prlink_project FOREIGN KEY (project_id) REFERENCES ef_projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_ef_prlink_a FOREIGN KEY (rack_a_id) REFERENCES ef_rack_instances(id) ON DELETE CASCADE,
  CONSTRAINT fk_ef_prlink_b FOREIGN KEY (rack_b_id) REFERENCES ef_rack_instances(id) ON DELETE CASCADE,
  KEY idx_ef_prlink_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
