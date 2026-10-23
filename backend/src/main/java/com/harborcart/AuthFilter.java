package com.harborcart;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AuthFilter extends OncePerRequestFilter {
    private final AuthService auth;
    private final ObjectMapper json;
    public AuthFilter(AuthService auth,ObjectMapper json){this.auth=auth;this.json=json;}
    protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException {
        res.setHeader("X-Content-Type-Options","nosniff");
        res.setHeader("Cache-Control","no-store");
        String path=req.getRequestURI().substring(req.getContextPath().length());
        boolean publicGet=req.getMethod().equals("GET")&&(path.equals("/api/products")||path.equals("/api/config"));
        boolean publicPost=req.getMethod().equals("POST")&&(path.equals("/api/auth/login")||path.equals("/api/auth/register"));
        if(path.startsWith("/api/")&&!publicGet&&!publicPost){
            try {req.setAttribute("user",auth.authenticate(req.getHeader("Authorization")));}
            catch(ApiException e){res.setStatus(e.status);res.setContentType("application/json;charset=UTF-8");json.writeValue(res.getWriter(),java.util.Map.of("message",e.getMessage()));return;}
        }
        chain.doFilter(req,res);
    }
}
