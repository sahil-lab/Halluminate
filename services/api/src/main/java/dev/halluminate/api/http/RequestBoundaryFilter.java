package dev.halluminate.api.http;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestBoundaryFilter extends OncePerRequestFilter {
  private static final Logger LOG = LoggerFactory.getLogger(RequestBoundaryFilter.class);
  private final Set<String> allowedOrigins;
  private final ObjectMapper mapper;

  public RequestBoundaryFilter(
      @Value("${app.allowed-origins}") String allowedOrigins, ObjectMapper mapper) {
    this.allowedOrigins =
        Arrays.stream(allowedOrigins.split(","))
            .map(String::trim)
            .filter(origin -> !origin.isBlank())
            .collect(Collectors.toUnmodifiableSet());
    this.mapper = mapper;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    long start = System.nanoTime();
    String requestId = UUID.randomUUID().toString();
    MDC.put("requestId", requestId);
    response.setHeader("X-Request-ID", requestId);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    try {
      String origin = request.getHeader("Origin");
      if ("POST".equals(request.getMethod())
          && request.getRequestURI().startsWith("/api/")
          && origin != null
          && !allowedOrigins.contains(origin)) {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        mapper.writeValue(
            response.getOutputStream(),
            ApiProblems.create(HttpStatus.FORBIDDEN, "This browser origin is not allowed."));
        return;
      }
      chain.doFilter(request, response);
    } finally {
      LOG.info(
          "http.request method={} status={} durationMs={}",
          request.getMethod(),
          response.getStatus(),
          (System.nanoTime() - start) / 1_000_000);
      MDC.remove("requestId");
    }
  }
}
