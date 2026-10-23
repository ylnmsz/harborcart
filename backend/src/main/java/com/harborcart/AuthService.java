package com.harborcart;

import static com.harborcart.Models.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final JdbcTemplate db;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    public AuthService(JdbcTemplate db) { this.db=db; }
    String hashPassword(String password) {
        if(password.getBytes(StandardCharsets.UTF_8).length>72) throw new ApiException(400,"密码不得超过 72 字节");
        return passwords.encode(password);
    }
    @Transactional
    public Map<String,Object> register(Register input) {
        String email=input.email().toLowerCase(Locale.ROOT).trim();
        if(!db.queryForList("SELECT id FROM users WHERE email=?",email).isEmpty())throw new ApiException(409,"邮箱已注册");
        db.update("INSERT INTO users(email,password_hash,name,role) VALUES(?,?,?,'BUYER')",email,hashPassword(input.password()),input.name().trim());
        return login(new Login(email,input.password()));
    }
    public Map<String,Object> login(Login input) {
        var rows=db.queryForList("SELECT * FROM users WHERE email=?",input.email().toLowerCase(Locale.ROOT).trim());
        // Compare a valid dummy hash as well, so unknown users do not skip password work.
        String stored=rows.isEmpty()?"$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy":rows.get(0).get("password_hash").toString();
        if(input.password().getBytes(StandardCharsets.UTF_8).length>72 || !passwords.matches(input.password(),stored) || rows.isEmpty())throw new ApiException(401,"邮箱或密码错误");
        var row=rows.get(0);long id=((Number)row.get("id")).longValue();
        byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        db.update("DELETE FROM auth_tokens WHERE expires_at < ?",Timestamp.from(Instant.now()));
        db.update("INSERT INTO auth_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)",digest(token),id,Timestamp.from(Instant.now().plus(Duration.ofHours(8))));
        return Map.of("token",token,"user",new User(id,row.get("email").toString(),row.get("name").toString(),row.get("role").toString()));
    }
    public User authenticate(String header) {
        if(header==null || !header.startsWith("Bearer ") || header.length()>200)throw new ApiException(401,"请先登录");
        var rows=db.query("SELECT u.id,u.email,u.name,u.role FROM users u JOIN auth_tokens t ON t.user_id=u.id WHERE t.token_hash=? AND t.expires_at>?",
            (r,n)->new User(r.getLong(1),r.getString(2),r.getString(3),r.getString(4)),digest(header.substring(7)),Timestamp.from(Instant.now()));
        if(rows.isEmpty())throw new ApiException(401,"登录已过期，请重新登录");
        return rows.get(0);
    }
    public void logout(String header) { db.update("DELETE FROM auth_tokens WHERE token_hash=?",digest(header.substring(7))); }
    private String digest(String token) {
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }
}
