package com.glpi.reinit.backend.kanban;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

public interface TicketCostsExtraRepository extends JpaRepository<TicketCostsExtra, Integer> {

  List<TicketCostsExtra> findByRefTicket(String refTicket);

  @Query("SELECT COALESCE(SUM(t.costFixed), 0.0) FROM TicketCostsExtra t WHERE t.refTicket = :refTicket")
  Double sumCostFixedByRefTicket(@Param("refTicket") String refTicket);

  @Query("SELECT COALESCE(SUM(t.costFixed), 0.0) FROM TicketCostsExtra t WHERE t.refTicket = :refTicket AND t.createdAt > :since")
  Double sumCostFixedByRefTicketSince(@Param("refTicket") String refTicket, @Param("since") LocalDateTime since);

  @Transactional
  void deleteByRefTicket(String refTicket);
}
