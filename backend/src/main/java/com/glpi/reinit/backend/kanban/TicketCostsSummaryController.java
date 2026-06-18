package com.glpi.reinit.backend.kanban;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/ticket-costs-summary")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174", "http://localhost:5176"})
public class TicketCostsSummaryController {

  @Autowired private TicketCostsSummaryRepository repo;

  @GetMapping
  public List<TicketCostsSummary> obtenirResume() {
    return repo.findAll();
  }
}
