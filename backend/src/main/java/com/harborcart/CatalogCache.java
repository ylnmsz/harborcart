package com.harborcart;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.*;

@Component
public class CatalogCache {
    private final StringRedisTemplate redis; private final JdbcTemplate db; private final ObjectMapper json; private final boolean enabled;
    private final AtomicLong retryAfter=new AtomicLong();
    private static final String KEY="harborcart:catalog:v1";
    private static final Logger log=LoggerFactory.getLogger(CatalogCache.class);
    public CatalogCache(StringRedisTemplate redis,JdbcTemplate db,ObjectMapper json,@Value("${app.cache-enabled}")boolean enabled){this.redis=redis;this.db=db;this.json=json;this.enabled=enabled;}
    public List<Map<String,Object>> products(){
        boolean available=enabled&&System.currentTimeMillis()>retryAfter.get();
        if(available)try{String value=redis.opsForValue().get(KEY);if(value!=null)return json.readValue(value,new TypeReference<>(){});}catch(Exception e){failed();available=false;}
        var products=db.queryForList("SELECT * FROM products WHERE active=TRUE ORDER BY id");
        if(available)try{redis.opsForValue().set(KEY,json.writeValueAsString(products),Duration.ofSeconds(60));}catch(Exception e){failed();}
        return products;
    }
    public void evict(){if(enabled)try{redis.delete(KEY);}catch(Exception e){failed();}}
    private void failed(){retryAfter.set(System.currentTimeMillis()+30000);log.warn("Redis unavailable; catalog falls back to MySQL for 30s");}
}
