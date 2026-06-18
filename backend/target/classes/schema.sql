CREATE TABLE IF NOT EXISTS kanban_settings (
  status    INTEGER PRIMARY KEY,
  bg_color  TEXT NOT NULL DEFAULT '#ffffff',
  label_mg  TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO kanban_settings (status, bg_color, label_mg) VALUES
  (1, '#e8f4fd', 'vaovao'),
  (2, '#fff8e1', 'efa manao'),
  (5, '#e8f5e9', 'vita');

CREATE TABLE IF NOT EXISTS ticket_costs_extra (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_ticket TEXT    NOT NULL,
  cost_fixed REAL    NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_reouverture (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_ticket TEXT    NOT NULL,
  percentage REAL    NOT NULL,
  base_extra REAL    NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour recherches par ref_ticket
CREATE INDEX IF NOT EXISTS idx_ticket_costs_extra_ref ON ticket_costs_extra(ref_ticket);
CREATE INDEX IF NOT EXISTS idx_ticket_reouverture_ref ON ticket_reouverture(ref_ticket);

-- Récréer la vue SQL avec ref_ticket (drop ancienne si elle existe)
DROP VIEW IF EXISTS v_ticket_costs_summary;

-- Vue SQL : agrège coûts extra et coûts réouverture par ticket
-- super_prix_total  = somme de tous les coûts extra du ticket
-- cout_reouv_total  = somme de (pct/100 × base_extra) pour chaque réouverture du ticket
CREATE VIEW v_ticket_costs_summary AS
SELECT
  t.ref_ticket,
  (SELECT COALESCE(SUM(e.cost_fixed), 0.0)
   FROM ticket_costs_extra e
   WHERE e.ref_ticket = t.ref_ticket)                           AS super_prix_total,
  (SELECT COALESCE(SUM(r.percentage / 100.0 * r.base_extra), 0.0)
   FROM ticket_reouverture r
   WHERE r.ref_ticket = t.ref_ticket)                           AS cout_reouv_total
FROM (
  SELECT ref_ticket FROM ticket_costs_extra
  UNION

  SELECT ref_ticket FROM ticket_reouverture
) t;

