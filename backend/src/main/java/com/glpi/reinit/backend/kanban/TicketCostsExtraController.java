package com.glpi.reinit.backend.kanban;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ticket-costs")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174", "http://localhost:5176"})
public class TicketCostsExtraController {

  @Autowired
  private TicketCostsExtraRepository repo;

  @GetMapping("/{refTicket}")
  public List<TicketCostsExtra> obtenirParTicket(@PathVariable String refTicket) {
    return repo.findByRefTicket(refTicket);
  }

  @PostMapping("/{refTicket}")
  public TicketCostsExtra ajouterCout(
    @PathVariable String refTicket,
    @RequestBody Map<String, Object> body
  ) {
    Double costFixed = ((Number) body.get("cost_fixed")).doubleValue();
    TicketCostsExtra cout = new TicketCostsExtra(refTicket, costFixed);
    return repo.save(cout);
  }

  @GetMapping
  public List<TicketCostsExtra> obtenirTous() {
    return repo.findAll();
  }

  @DeleteMapping("/{refTicket}")
  public Map<String, String> supprimerParTicket(@PathVariable String refTicket) {
    repo.deleteByRefTicket(refTicket);
    return Map.of("status", "deleted");
  }

  @DeleteMapping("/{refTicket}/dernier")
  public Map<String, String> supprimerDernier(@PathVariable String refTicket) {
    repo.findByRefTicket(refTicket).stream()
      .max(Comparator.comparing(TicketCostsExtra::getId))
      .ifPresent(repo::delete);
    return Map.of("status", "deleted");
  }
}
