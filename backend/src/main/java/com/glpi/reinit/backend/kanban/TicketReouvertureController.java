package com.glpi.reinit.backend.kanban;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.Comparator;

@RestController
@RequestMapping("/api/ticket-reouverture")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174", "http://localhost:5176"})
public class TicketReouvertureController {

  @Autowired private TicketReouvertureRepository repo;
  @Autowired private TicketCostsExtraRepository  coutsRepo;

  @GetMapping
  public List<TicketReouverture> obtenirTous() {
    return repo.findAll();
  }

  private Double calculateBaseExtra(String refTicket, String mode) {
    List<TicketCostsExtra> costs = coutsRepo.findByRefTicket(refTicket);
    if (costs.isEmpty()) return 0.0;
    switch (mode) {
      case "mode1": return costs.stream().max(Comparator.comparing(TicketCostsExtra::getCostFixed)).map(TicketCostsExtra::getCostFixed).orElse(0.0);
      case "mode2": return costs.stream().min(Comparator.comparing(TicketCostsExtra::getCostFixed)).map(TicketCostsExtra::getCostFixed).orElse(0.0);
      case "mode3": return costs.stream().mapToDouble(TicketCostsExtra::getCostFixed).average().orElse(0.0);
      case "mode4": return costs.stream().mapToDouble(TicketCostsExtra::getCostFixed).sum();
      default: return 0.0;
    }
  }

  @PostMapping("/{refTicket}")
  public TicketReouverture enregistrer(
      @PathVariable String refTicket,
      @RequestBody Map<String, Object> body) {

    Double percentage = ((Number) body.get("percentage")).doubleValue();
    String mode = (String) body.getOrDefault("mode", "mode1");
    Double baseExtra = calculateBaseExtra(refTicket, mode);
    return repo.save(new TicketReouverture(refTicket, percentage, baseExtra));
  }

  @DeleteMapping("/{refTicket}/dernier")
  public Map<String, String> supprimerDernier(@PathVariable String refTicket) {
    repo.findFirstByRefTicketOrderByIdDesc(refTicket).ifPresent(repo::delete);
    return Map.of("status", "deleted");
  }
}
