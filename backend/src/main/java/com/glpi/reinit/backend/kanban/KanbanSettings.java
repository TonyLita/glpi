package com.glpi.reinit.backend.kanban;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "kanban_settings")
public class KanbanSettings {

  @Id
  private Integer status;
  private String bgColor;
  private String labelMg;

  public KanbanSettings() {}

  public KanbanSettings(Integer status, String bgColor, String labelMg) {
    this.status = status;
    this.bgColor = bgColor;
    this.labelMg = labelMg;
  }

  public Integer getStatus() {
    return status;
  }

  public void setStatus(Integer status) {
    this.status = status;
  }

  public String getBgColor() {
    return bgColor;
  }

  public void setBgColor(String bgColor) {
    this.bgColor = bgColor;
  }

  public String getLabelMg() {
    return labelMg;
  }

  public void setLabelMg(String labelMg) {
    this.labelMg = labelMg;
  }
}
