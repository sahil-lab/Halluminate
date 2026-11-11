package dev.halluminate.api.bootstrap;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ProbeRequest(@NotBlank @Pattern(regexp = "phase-1-synthetic") String fixture) {}
