package com.glpi.reinit.backend.kanban;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface KanbanSettingsRepository extends JpaRepository<KanbanSettings, Integer> {
}
