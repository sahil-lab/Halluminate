package dev.halluminate.api.http;

import dev.halluminate.api.bootstrap.ProbeNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
  private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(ProbeNotFoundException.class)
  public ResponseEntity<ProblemDetail> notFound(ProbeNotFoundException exception) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(ApiProblems.create(HttpStatus.NOT_FOUND, exception.getMessage()));
  }

  @ExceptionHandler(DataAccessException.class)
  public ResponseEntity<ProblemDetail> databaseUnavailable(DataAccessException exception) {
    LOG.error("bootstrap.database_unavailable errorType={}", exception.getClass().getSimpleName());
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(
            ApiProblems.create(
                HttpStatus.SERVICE_UNAVAILABLE, "Database is unavailable. Retry the local check."));
  }

  @Override
  protected ResponseEntity<Object> handleExceptionInternal(
      Exception exception,
      Object body,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    String detail =
        switch (status.value()) {
          case 400 ->
              "Invalid request. Use only the documented synthetic fixture and valid identifiers.";
          case 404 -> "The requested resource was not found.";
          case 405 -> "This HTTP method is not supported.";
          case 415 -> "Content-Type must be application/json.";
          default -> "The request could not be processed.";
        };
    return super.handleExceptionInternal(
        exception, ApiProblems.create(status, detail), headers, status, request);
  }
}
