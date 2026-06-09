CREATE TABLE IF NOT EXISTS kanban_settings (
  status    INTEGER PRIMARY KEY,
  bg_color  TEXT NOT NULL DEFAULT '#ffffff',
  label_mg  TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO kanban_settings (status, bg_color, label_mg) VALUES
  (1, '#e8f4fd', 'vaovao'),
  (2, '#fff8e1', 'efa manao'),
  (5, '#e8f5e9', 'vita');
