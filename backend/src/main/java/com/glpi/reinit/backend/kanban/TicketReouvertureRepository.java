package com.glpi.reinit.backend.kanban;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

public interface TicketReouvertureRepository extends JpaRepository<TicketReouverture, Integer> {

  List<TicketReouverture> findByRefTicket(String refTicket);

  Optional<TicketReouverture> findFirstByRefTicketOrderByIdDesc(String refTicket);

  @Transactional
  void deleteByRefTicket(String refTicket);
}
