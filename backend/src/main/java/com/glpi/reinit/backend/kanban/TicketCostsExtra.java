package com.glpi.reinit.backend.kanban;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ticket_costs_extra")
public class TicketCostsExtra {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Integer id;

  @Column(name = "ref_ticket", nullable = false)
  private String refTicket;

  @Column(name = "cost_fixed", nullable = false)
  private Double costFixed;

  @Column(name = "created_at")
  private LocalDateTime createdAt;

  public TicketCostsExtra() {}

  public TicketCostsExtra(String refTicket, Double costFixed) {
    this.refTicket = refTicket;
    this.costFixed = costFixed;
    this.createdAt = LocalDateTime.now();
  }

  public Integer getId() {
    return id;
  }

  public void setId(Integer id) {
    this.id = id;
  }

  public String getRefTicket() {
    return refTicket;
  }

  public void setRefTicket(String refTicket) {
    this.refTicket = refTicket;
  }

  public Double getCostFixed() {
    return costFixed;
  }

  public void setCostFixed(Double costFixed) {
    this.costFixed = costFixed;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }
}
