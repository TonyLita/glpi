package com.glpi.reinit.backend.kanban;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ticket_reouverture")
public class TicketReouverture {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Integer id;

  @Column(name = "ref_ticket", nullable = false)
  private String refTicket;

  @Column(name = "percentage", nullable = false)
  private Double percentage;

  @Column(name = "base_extra", nullable = false)
  private Double baseExtra = 0.0;

  @Column(name = "created_at")
  private LocalDateTime createdAt;

  public TicketReouverture() {}

  public TicketReouverture(String refTicket, Double percentage, Double baseExtra) {
    this.refTicket = refTicket;
    this.percentage = percentage;
    this.baseExtra = baseExtra;
    this.createdAt = LocalDateTime.now();
  }

  public Integer getId()                    { return id; }
  public String getRefTicket()              { return refTicket; }
  public Double  getPercentage()            { return percentage; }
  public Double  getBaseExtra()             { return baseExtra; }
  public LocalDateTime getCreatedAt()       { return createdAt; }

  public void setId(Integer id)                       { this.id = id; }
  public void setRefTicket(String refTicket)          { this.refTicket = refTicket; }
  public void setPercentage(Double percentage)        { this.percentage = percentage; }
  public void setBaseExtra(Double baseExtra)          { this.baseExtra = baseExtra; }
  public void setCreatedAt(LocalDateTime createdAt)   { this.createdAt = createdAt; }
}
