package dev.halluminate.api.bootstrap;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ProbeRepository {
  private static final RowMapper<Probe> MAPPER =
      (row, index) ->
          new Probe(
              row.getObject("id", UUID.class),
              row.getString("fixture"),
              row.getTimestamp("created_at").toInstant());

  private final JdbcTemplate jdbc;

  public ProbeRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Probe check(String fixture) {
    // The conflict branch preserves the first probe's identity across retries/restarts.
    return jdbc.queryForObject(
        """
        INSERT INTO bootstrap_probes (id, fixture) VALUES (?, ?)
        ON CONFLICT (fixture) DO UPDATE SET fixture = EXCLUDED.fixture
        RETURNING id, fixture, created_at
        """,
        MAPPER,
        UUID.randomUUID(),
        fixture);
  }

  public Probe find(UUID id) {
    return jdbc
        .query("SELECT id, fixture, created_at FROM bootstrap_probes WHERE id = ?", MAPPER, id)
        .stream()
        .findFirst()
        .orElseThrow(ProbeNotFoundException::new);
  }
}
