package com.glpi.reinit.backend.kanban;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.Comparator;
import java.util.Optional;
import java.io.BufferedReader;
import java.io.InputStreamReader;

@RestController
@RequestMapping("/api/mouvements")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174", "http://localhost:5176"})
public class MouvementController {

  @Autowired private TicketCostsExtraRepository coutsRepo;
  @Autowired private TicketReouvertureRepository reouvertureRepo;

  @PostMapping("/importer")
  public List<Map<String, Object>> importer(@RequestParam("fichier") MultipartFile fichier) throws Exception {
    List<Map<String, Object>> resultats = new ArrayList<>();

    try (BufferedReader reader = new BufferedReader(new InputStreamReader(fichier.getInputStream()))) {
      String ligne;
      boolean entete = true;
      while ((ligne = reader.readLine()) != null) {
        ligne = ligne.trim();
        if (ligne.isEmpty()) continue;
        if (entete) {
          entete = false;
          continue;
        }

        String[] parts = ligne.split(";");
        if (parts.length < 2) continue;

        try {
          String refTicket = parts[0].trim();
          MouvementType mouvementType = MouvementType.fromCsv(parts[1].trim());
          Double valeur = parts.length > 2 && !parts[2].trim().isEmpty()
            ? tryParseDouble(parts[2].trim())
            : null;
          String mode = parts.length > 3 && !parts[3].trim().isEmpty()
            ? parts[3].trim()
            : "mode1";

          switch (mouvementType) {
            case REOUVERTURE:
              if (valeur == null) continue;
              Double baseExtra = calculateBaseExtra(refTicket, mode);
              TicketReouverture r = reouvertureRepo.save(
                new TicketReouverture(refTicket, valeur, baseExtra)
              );
              resultats.add(Map.of(
                "action", "reouverture",
                "ref_ticket", refTicket,
                "percentage", valeur,
                "id", r.getId()
              ));
              break;

            case COUT_FINAL:
              if (valeur == null) continue;
              TicketCostsExtra c = coutsRepo.save(new TicketCostsExtra(refTicket, valeur));
              resultats.add(Map.of(
                "action", "cout_final",
                "ref_ticket", refTicket,
                "cost_fixed", valeur,
                "id", c.getId()
              ));
              break;

            case ANNULATION_COUT:
              coutsRepo.findByRefTicket(refTicket).stream()
                .max(Comparator.comparing(TicketCostsExtra::getId))
                .ifPresent(coutsRepo::delete);
              resultats.add(Map.of(
                "action", "annulation_cout",
                "ref_ticket", refTicket
              ));
              break;
          }
        } catch (IllegalArgumentException e) {
          // Ignore lignes avec type de mouvement invalide
          continue;
        } catch (Exception e) {
          // Ignore autres erreurs
          continue;
        }
      }
    }

    return resultats;
  }

  @PostMapping("/ajouter")
  public Map<String, Object> ajouter(@RequestBody Map<String, Object> body) throws Exception {
    String refTicket = (String) body.get("refTicket");
    String typeStr = (String) body.get("type");
    String mode = (String) body.getOrDefault("mode", "mode1");
    MouvementType mouvementType = MouvementType.fromCsv(typeStr);
    Double valeur = body.containsKey("valeur") && body.get("valeur") != null
      ? ((Number) body.get("valeur")).doubleValue()
      : null;

    switch (mouvementType) {
      case REOUVERTURE:
        if (valeur == null) throw new IllegalArgumentException("Valeur requise pour réouverture");
        Double baseExtra = calculateBaseExtra(refTicket, mode);
        TicketReouverture r = reouvertureRepo.save(new TicketReouverture(refTicket, valeur, baseExtra));
        return Map.of("id", r.getId(), "ref_ticket", refTicket, "percentage", valeur, "action", "reouverture");

      case COUT_FINAL:
        if (valeur == null) throw new IllegalArgumentException("Valeur requise pour coût final");
        TicketCostsExtra c = coutsRepo.save(new TicketCostsExtra(refTicket, valeur));
        return Map.of("id", c.getId(), "ref_ticket", refTicket, "cost_fixed", valeur, "action", "cout_final");

      case ANNULATION_COUT:
        coutsRepo.findByRefTicket(refTicket).stream()
          .max(Comparator.comparing(TicketCostsExtra::getId))
          .ifPresent(coutsRepo::delete);
        return Map.of("ref_ticket", refTicket, "action", "annulation_cout");

      default:
        throw new IllegalArgumentException("Type invalide: " + typeStr);
    }
  }

  private Double calculateBaseExtra(String refTicket, String mode) {
    List<TicketCostsExtra> costs = coutsRepo.findByRefTicket(refTicket);
    if (costs.isEmpty()) return 0.0;
    switch (mode) {
      case "mode1": return costs.stream().max(Comparator.comparing(TicketCostsExtra::getCreatedAt)).map(TicketCostsExtra::getCostFixed).orElse(0.0);
      case "mode2": return costs.stream().min(Comparator.comparing(TicketCostsExtra::getCreatedAt)).map(TicketCostsExtra::getCostFixed).orElse(0.0);
      case "mode3": return costs.stream().mapToDouble(TicketCostsExtra::getCostFixed).average().orElse(0.0);
      case "mode4": return costs.stream().mapToDouble(TicketCostsExtra::getCostFixed).sum();
      default: return 0.0;
    }
  }

  private Double tryParseDouble(String s) {
    try {
      return Double.parseDouble(s.replace(",", "."));
    } catch (NumberFormatException e) {
      return null;
    }
  }
}
