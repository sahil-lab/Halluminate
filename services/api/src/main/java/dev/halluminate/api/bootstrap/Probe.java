package dev.halluminate.api.bootstrap;

import java.time.Instant;
import java.util.UUID;

public record Probe(UUID id, String fixture, Instant createdAt) {}
