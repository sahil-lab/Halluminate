package dev.halluminate.api.bootstrap;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ProbeController.class)
class ProbeControllerTest {
  @Autowired private MockMvc mvc;
  @MockitoBean private ProbeRepository repository;

  @Test
  void returnsThePersistedSyntheticProbe() throws Exception {
    UUID id = UUID.randomUUID();
    when(repository.check("phase-1-synthetic"))
        .thenReturn(new Probe(id, "phase-1-synthetic", Instant.parse("2026-01-01T00:00:00Z")));

    mvc.perform(
            post("/api/bootstrap/probes")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"fixture\":\"phase-1-synthetic\"}"))
        .andExpect(status().isOk())
        .andExpect(header().exists("X-Request-ID"))
        .andExpect(jsonPath("$.id").value(id.toString()))
        .andExpect(jsonPath("$.fixture").value("phase-1-synthetic"))
        .andExpect(jsonPath("$.createdAt").value("2026-01-01T00:00:00Z"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{}",
        "{\"fixture\":null}",
        "{\"fixture\":\"\"}",
        "{\"fixture\":\"  \"}",
        "{\"fixture\":\"fictional-but-not-approved\"}",
        "{\"fixture\":\"phase-1-synthetic\",\"extra\":\"not-allowed\"}",
        "{\"fixture\":123}",
        "{\"fixture\":",
        "{\"fixture\":\"phase-1-synthetic\"} {}"
      })
  void rejectsInvalidBodiesBeforePersistence(String body) throws Exception {
    mvc.perform(post("/api/bootstrap/probes").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.requestId").isString());
    verifyNoInteractions(repository);
  }

  @Test
  void rejectsUnexpectedOrigin() throws Exception {
    mvc.perform(
            post("/api/bootstrap/probes")
                .header("Origin", "https://untrusted.invalid")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"fixture\":\"phase-1-synthetic\"}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.requestId").isString());
    verifyNoInteractions(repository);
  }

  @Test
  void rejectsInvalidUuid() throws Exception {
    mvc.perform(get("/api/bootstrap/probes/not-a-uuid"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.status").value(400));
    verifyNoInteractions(repository);
  }

  @Test
  void reportsMissingProbe() throws Exception {
    when(repository.find(any(UUID.class))).thenThrow(new ProbeNotFoundException());
    mvc.perform(get("/api/bootstrap/probes/" + UUID.randomUUID()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.detail").value("Bootstrap probe was not found."));
  }

  @Test
  void doesNotLeakDatabaseFailureDetails() throws Exception {
    when(repository.check("phase-1-synthetic"))
        .thenThrow(new DataAccessResourceFailureException("internal-database-detail"));
    mvc.perform(
            post("/api/bootstrap/probes")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"fixture\":\"phase-1-synthetic\"}"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.detail").value("Database is unavailable. Retry the local check."))
        .andExpect(jsonPath("$.requestId").isString())
        .andExpect(
            content()
                .string(
                    org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("internal-database-detail"))));
  }
}
