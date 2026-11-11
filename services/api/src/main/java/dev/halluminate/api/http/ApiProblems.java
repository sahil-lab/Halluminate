package dev.halluminate.api.http;

import org.slf4j.MDC;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;

public final class ApiProblems {
  private ApiProblems() {}

  public static ProblemDetail create(HttpStatusCode status, String detail) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setProperty("requestId", MDC.get("requestId"));
    return problem;
  }
}
