package com.glpi.reinit.backend.kanban;

public enum MouvementType {
  REOUVERTURE("reouverture"),
  COUT_FINAL("cout_final"),
  ANNULATION_COUT("annulation_cout");

  private String value;

  MouvementType(String value) {
    this.value = value;
  }

  public String getValue() {
    return value;
  }

  public static MouvementType fromCsv(String csvType) throws IllegalArgumentException {
    if (csvType == null) {
      throw new IllegalArgumentException("Type CSV ne peut pas être null");
    }

    switch (csvType.toLowerCase().trim()) {
      case "open":
        return REOUVERTURE;
      case "close":
        return COUT_FINAL;
      case "cancel":
        return ANNULATION_COUT;
      default:
        throw new IllegalArgumentException("Type CSV invalide: " + csvType);
    }
  }
}
