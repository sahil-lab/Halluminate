package dev.halluminate.api.bootstrap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ProbePersistenceIT {
  @Autowired private ProbeRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void migrationAndRepeatedWritesProduceOneDurableProbe() {
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE version = '1' AND success",
                Integer.class))
        .isEqualTo(1);

    Probe first = repository.check("phase-1-synthetic");
    Probe second = repository.check("phase-1-synthetic");

    assertThat(second).isEqualTo(first);
    assertThat(repository.find(first.id())).isEqualTo(first);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM bootstrap_probes", Integer.class))
        .isEqualTo(1);
  }

  @Test
  void databaseRejectsNonSyntheticFixturesEvenWithoutHttpValidation() {
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "INSERT INTO bootstrap_probes (id, fixture) VALUES (?, ?)",
                    UUID.randomUUID(),
                    "unapproved-fixture"))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void missingIdDoesNotInventAProbe() {
    assertThatThrownBy(() -> repository.find(UUID.randomUUID()))
        .isInstanceOf(ProbeNotFoundException.class);
  }
}
