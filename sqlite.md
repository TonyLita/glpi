# connexion base sqlite: 
sqlite3 'D:\Evaluation\clientglpi\glpi-main\glpireinit-app\backend\data\glpi_reinit.db'
sqlite3 'D:\Evaluation\clientglpi\glpi-main\glpireinit-app\backend\data\glpi_reinit.db' ".tables"


# les éléments de la table;

SELECT * FROM kanban_settings;
SELECT * FROM ticket_costs_extra;
SELECT * FROM ticket_reouverture;
SELECT * FROM v_ticket_costs_summary;

-- Compter lignes par table
SELECT COUNT(*) FROM kanban_settings;
SELECT COUNT(*) FROM ticket_costs_extra;
SELECT COUNT(*) FROM ticket_reouverture;

