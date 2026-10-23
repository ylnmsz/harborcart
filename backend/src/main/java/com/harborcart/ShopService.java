package com.harborcart;

import static com.harborcart.Models.*;
import java.math.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;

@Service
public class ShopService {
    public static final Map<String,BigDecimal> RATES=Map.of("USD",new BigDecimal("1.0000"),"EUR",new BigDecimal("0.9200"),"GBP",new BigDecimal("0.7900"));
    private static final Map<String,BigDecimal> FREIGHT=Map.of("US",new BigDecimal("12"),"DE",new BigDecimal("15"),"GB",new BigDecimal("14"));
    private final JdbcTemplate db;private final CatalogCache cache;
    public ShopService(JdbcTemplate db,CatalogCache cache){this.db=db;this.cache=cache;}
    public List<Map<String,Object>> cart(long user){return db.queryForList("SELECT p.*,c.quantity FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=? ORDER BY p.id",user);}
    private void lockUser(long user){db.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE",Long.class,user);}
    @Transactional
    public void changeCart(long user,long product,int quantity){
        lockUser(user);
        if(quantity==0){db.update("DELETE FROM cart_items WHERE user_id=? AND product_id=?",user,product);return;}
        var row=product(product,false);
        if(!Boolean.TRUE.equals(row.get("active"))||number(row,"stock")<quantity)throw new ApiException(409,"商品已下架或库存不足");
        db.update("DELETE FROM cart_items WHERE user_id=? AND product_id=?",user,product);
        db.update("INSERT INTO cart_items(user_id,product_id,quantity) VALUES(?,?,?)",user,product,quantity);
    }
    public Map<String,Object> quote(long user,String currency,String country){return price(cart(user),currency,country);}
    private Map<String,Object> price(List<Map<String,Object>> rows,String currency,String country){
        BigDecimal rate=RATES.get(currency),freight=FREIGHT.get(country);
        if(rate==null||freight==null)throw new ApiException(400,"暂不支持该币种或配送国家");
        BigDecimal base=BigDecimal.ZERO,subtotal=BigDecimal.ZERO;
        for(var r:rows){BigDecimal usd=new BigDecimal(r.get("price").toString());int qty=number(r,"quantity");base=base.add(usd.multiply(BigDecimal.valueOf(qty)));subtotal=subtotal.add(convert(usd,rate).multiply(BigDecimal.valueOf(qty)));}
        BigDecimal shipping=rows.isEmpty()||base.compareTo(new BigDecimal("100"))>=0?new BigDecimal("0.00"):convert(freight,rate);
        return Map.of("currency",currency,"country",country,"exchangeRate",rate,"subtotal",subtotal.setScale(2),"shipping",shipping,"total",subtotal.add(shipping).setScale(2));
    }
    private BigDecimal convert(BigDecimal amount,BigDecimal rate){return amount.multiply(rate).setScale(2,RoundingMode.HALF_UP);}
    @Transactional
    public Map<String,Object> checkout(long user,Checkout input){
        lockUser(user);
        var existing=db.queryForList("SELECT id FROM shop_orders WHERE user_id=? AND request_key=?",user,input.requestKey());
        if(!existing.isEmpty())return order(user,((Number)existing.get(0).get("id")).longValue(),false);
        var rows=cart(user);if(rows.isEmpty())throw new ApiException(400,"购物车为空");
        // Lock products in id order to keep competing checkouts from overselling or deadlocking.
        for(var row:rows){var current=product(((Number)row.get("id")).longValue(),true);if(!Boolean.TRUE.equals(current.get("active"))||number(current,"stock")<number(row,"quantity"))throw new ApiException(409,"商品已下架或库存不足："+row.get("name"));row.putAll(current);}
        var totals=price(rows,input.currency(),input.country());
        KeyHolder key=new GeneratedKeyHolder();
        db.update(connection->{var ps=connection.prepareStatement("INSERT INTO shop_orders(user_id,request_key,status,currency,country,recipient,address,subtotal,shipping,total,exchange_rate) VALUES(?,?,'PENDING',?,?,?,?,?,?,?,?)",new String[]{"id"});
            ps.setLong(1,user);ps.setString(2,input.requestKey());ps.setString(3,input.currency());ps.setString(4,input.country());ps.setString(5,input.recipient().trim());ps.setString(6,input.address().trim());ps.setBigDecimal(7,(BigDecimal)totals.get("subtotal"));ps.setBigDecimal(8,(BigDecimal)totals.get("shipping"));ps.setBigDecimal(9,(BigDecimal)totals.get("total"));ps.setBigDecimal(10,(BigDecimal)totals.get("exchangeRate"));return ps;},key);
        long id=Objects.requireNonNull(key.getKey()).longValue();
        for(var row:rows){long product=((Number)row.get("id")).longValue();int qty=number(row,"quantity");
            int changed=db.update("UPDATE products SET stock=stock-? WHERE id=? AND stock>=? AND active=TRUE",qty,product,qty);
            if(changed!=1)throw new ApiException(409,"库存发生变化，请重试");
            db.update("INSERT INTO order_items(order_id,product_id,name,unit_price,quantity) VALUES(?,?,?,?,?)",id,product,row.get("name"),convert(new BigDecimal(row.get("price").toString()),RATES.get(input.currency())),qty);
        }
        db.update("DELETE FROM cart_items WHERE user_id=?",user);evictAfterCommit();return order(user,id,false);
    }
    public List<Map<String,Object>> orders(long user,boolean admin){
        var rows=admin?db.queryForList("SELECT o.*,u.email FROM shop_orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 200"):db.queryForList("SELECT * FROM shop_orders WHERE user_id=? ORDER BY id DESC LIMIT 200",user);
        rows.forEach(this::attachItems);return rows;
    }
    public Map<String,Object> order(long user,long id,boolean admin){
        var rows=admin?db.queryForList("SELECT * FROM shop_orders WHERE id=?",id):db.queryForList("SELECT * FROM shop_orders WHERE id=? AND user_id=?",id,user);
        if(rows.isEmpty())throw new ApiException(404,"订单不存在");var row=rows.get(0);attachItems(row);return row;
    }
    private void attachItems(Map<String,Object> order){order.put("items",db.queryForList("SELECT * FROM order_items WHERE order_id=? ORDER BY product_id",order.get("id")));}
    @Transactional
    public void cancel(long user,long id){
        lockUser(user);var order=lockedOrder(user,id,false);
        if("CANCELLED".equals(order.get("status")))return;
        if(!"PENDING".equals(order.get("status")))throw new ApiException(409,"仅待付款订单可取消");
        for(var item:db.queryForList("SELECT * FROM order_items WHERE order_id=? ORDER BY product_id",id))db.update("UPDATE products SET stock=stock+? WHERE id=?",item.get("quantity"),item.get("product_id"));
        db.update("UPDATE shop_orders SET status='CANCELLED' WHERE id=?",id);evictAfterCommit();
    }
    @Transactional
    public void pay(long user,long id){
        var order=lockedOrder(user,id,false);
        if("PAID".equals(order.get("status"))||"SHIPPED".equals(order.get("status")))return;
        if(!"PENDING".equals(order.get("status")))throw new ApiException(409,"订单状态不允许付款");
        db.update("UPDATE shop_orders SET status='PAID' WHERE id=?",id);
    }
    @Transactional
    public void ship(long id,String tracking){var order=lockedOrder(0,id,true);if(!"PAID".equals(order.get("status")))throw new ApiException(409,"仅已付款订单可发货");db.update("UPDATE shop_orders SET status='SHIPPED',tracking=? WHERE id=?",tracking.trim(),id);}
    private Map<String,Object> lockedOrder(long user,long id,boolean admin){
        var rows=admin?db.queryForList("SELECT * FROM shop_orders WHERE id=? FOR UPDATE",id):db.queryForList("SELECT * FROM shop_orders WHERE id=? AND user_id=? FOR UPDATE",id,user);
        if(rows.isEmpty())throw new ApiException(404,"订单不存在");return rows.get(0);
    }
    private Map<String,Object> product(long id,boolean lock){var rows=db.queryForList("SELECT * FROM products WHERE id=?"+(lock?" FOR UPDATE":""),id);if(rows.isEmpty())throw new ApiException(404,"商品不存在");return rows.get(0);}
    private int number(Map<String,Object> row,String key){return ((Number)row.get(key)).intValue();}
    public List<Map<String,Object>> adminProducts(){return db.queryForList("SELECT * FROM products ORDER BY id");}
    @Transactional
    public void saveProduct(Long id,Product p){
        if(id==null)db.update("INSERT INTO products(name,category,description,price,stock,image,active) VALUES(?,?,?,?,?,?,?)",p.name(),p.category(),p.description(),p.price(),p.stock(),p.image(),p.active());
        else{product(id,true);db.update("UPDATE products SET name=?,category=?,description=?,price=?,stock=?,image=?,active=? WHERE id=?",p.name(),p.category(),p.description(),p.price(),p.stock(),p.image(),p.active(),id);}
        evictAfterCommit();
    }
    public Map<String,Object> dashboard(){return Map.of("orders",db.queryForObject("SELECT COUNT(*) FROM shop_orders",Long.class),"pendingShipment",db.queryForObject("SELECT COUNT(*) FROM shop_orders WHERE status='PAID'",Long.class),"lowStock",db.queryForObject("SELECT COUNT(*) FROM products WHERE active=TRUE AND stock<10",Long.class),"sales",db.queryForList("SELECT currency,SUM(total) AS total FROM shop_orders WHERE status IN ('PAID','SHIPPED') GROUP BY currency"));}
    private void evictAfterCommit(){TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){cache.evict();}});}
}
