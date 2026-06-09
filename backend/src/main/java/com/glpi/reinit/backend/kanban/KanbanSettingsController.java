package com.glpi.reinit.backend.kanban;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/kanban-settings")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174", "http://localhost:5176"})
public class KanbanSettingsController {

  @Autowired
  private KanbanSettingsRepository repository;

  @GetMapping
  public List<KanbanSettings> getAll() {
    return repository.findAll();
  }

  @PutMapping
  public List<KanbanSettings> saveAll(@RequestBody List<KanbanSettings> settings) {
    repository.saveAll(settings);
    return repository.findAll();
  }
}
