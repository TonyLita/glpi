package com.glpi.reinit.backend.kanban;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import javax.sql.DataSource;
import java.sql.Connection;
import java.util.Map;

@RestController
@RequestMapping("/api/system")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174", "http://localhost:5176"})
public class SystemController {

  @Autowired private DataSource dataSource;

  @PostMapping("/cleanup-db")
  public Map<String, String> cleanupDatabase() throws Exception {
    try (Connection conn = dataSource.getConnection()) {
      conn.createStatement().execute("DELETE FROM ticket_costs_extra");
      conn.createStatement().execute("DELETE FROM ticket_reouverture");
      conn.createStatement().execute("DELETE FROM sqlite_sequence WHERE name IN ('ticket_costs_extra', 'ticket_reouverture')");
      return Map.of("status", "success", "message", "Base de données nettoyée");
    } catch (Exception e) {
      throw new RuntimeException("Erreur lors du nettoyage: " + e.getMessage(), e);
    }
  }
}
