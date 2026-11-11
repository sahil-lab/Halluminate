package dev.halluminate.api.bootstrap;

public class ProbeNotFoundException extends RuntimeException {
  public ProbeNotFoundException() {
    super("Bootstrap probe was not found.");
  }
}
