package dev.halluminate.api.bootstrap;

import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bootstrap/probes")
public class ProbeController {
  private final ProbeRepository repository;

  public ProbeController(ProbeRepository repository) {
    this.repository = repository;
  }

  @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  public Probe check(@Valid @RequestBody ProbeRequest request) {
    return repository.check(request.fixture());
  }

  @GetMapping("/{id}")
  public Probe find(@PathVariable UUID id) {
    return repository.find(id);
  }
}
