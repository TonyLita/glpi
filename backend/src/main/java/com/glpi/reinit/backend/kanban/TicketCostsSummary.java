package com.glpi.reinit.backend.kanban;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Table(name = "v_ticket_costs_summary")
public class TicketCostsSummary {

  @Id
  @Column(name = "ref_ticket")
  private String refTicket;

  @Column(name = "super_prix_total")
  private Double superPrixTotal;

  @Column(name = "cout_reouv_total")
  private Double coutReouvertureTotal;

  public String getRefTicket()              { return refTicket; }
  public Double  getSuperPrixTotal()        { return superPrixTotal; }
  public Double  getCoutReouvertureTotal()  { return coutReouvertureTotal; }
}
