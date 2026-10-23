package com.harborcart;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.slf4j.*;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger log=LoggerFactory.getLogger(ApiErrors.class);
    @ExceptionHandler(ApiException.class)
    ResponseEntity<?> api(ApiException e) { return ResponseEntity.status(e.status).body(Map.of("message",e.getMessage())); }
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class})
    ResponseEntity<?> invalid(Exception e) { return ResponseEntity.badRequest().body(Map.of("message","输入格式有误，请检查必填项、长度和数值范围")); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> conflict(Exception e) { return ResponseEntity.status(409).body(Map.of("message","数据发生冲突，请刷新后重试")); }
    @ExceptionHandler(Exception.class)
    ResponseEntity<?> unexpected(Exception e) { log.error("Request failed",e); return ResponseEntity.status(500).body(Map.of("message","服务暂时不可用，请稍后重试")); }
}
