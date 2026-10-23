package com.harborcart;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DemoData implements CommandLineRunner {
    private final JdbcTemplate db;private final AuthService auth;private final boolean demo;
    public DemoData(JdbcTemplate db,AuthService auth,@Value("${app.demo}")boolean demo){this.db=db;this.auth=auth;this.demo=demo;}
    @Override @Transactional public void run(String... args){
        if(!demo)return;
        addUser("buyer@harborcart.demo","BuyerDemo123!","Alex Chen","BUYER");addUser("admin@harborcart.demo","AdminDemo123!","运营管理员","ADMIN");
        if(db.queryForObject("SELECT COUNT(*) FROM products",Long.class)>0)return;
        add("Trail insulated bottle","Travel","A 750 ml stainless steel bottle. Double-wall insulation keeps your everyday adventures refreshed.",32,48,"bottle");
        add("Everyday canvas tote","Travel","Heavyweight cotton canvas, an inside pocket, and room for a little more. Your daily carry, simplified.",28,65,"bag");
        add("Arc desk lamp","Desk","A compact reading light with a warm glow and adjustable arm. USB powered, made for thoughtful workspaces.",68,24,"lamp");
        add("Studio ceramic cup","Home","A tactile ceramic cup with a generous handle. 350 ml, dishwasher safe, finished in a soft matte glaze.",24,80,"cup");
        add("Field travel pouch","Travel","A water-resistant organizer for cables, small essentials, and everything that tends to go missing.",22,8,"pouch");
        add("Fold laptop stand","Desk","An adjustable aluminum stand that folds flat. Built for a comfortable desk, wherever you open your laptop.",46,36,"stand");
    }
    private void addUser(String email,String password,String name,String role){if(db.queryForList("SELECT id FROM users WHERE email=?",email).isEmpty())db.update("INSERT INTO users(email,password_hash,name,role) VALUES(?,?,?,?)",email,auth.hashPassword(password),name,role);}
    private void add(String name,String category,String desc,int price,int stock,String image){db.update("INSERT INTO products(name,category,description,price,stock,image,active) VALUES(?,?,?,?,?,?,TRUE)",name,category,desc,price,stock,"/images/"+image+".svg");}
}
