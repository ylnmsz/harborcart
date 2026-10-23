package com.harborcart;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static com.harborcart.Models.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest @AutoConfigureMockMvc
class ShopIntegrationTest {
    @Autowired ShopService shop;@Autowired AuthService auth;@Autowired JdbcTemplate db;@Autowired MockMvc mvc;@Autowired ObjectMapper json;
    long buyer;long other;
    @BeforeEach void setup(){
        db.update("DELETE FROM order_items");db.update("DELETE FROM shop_orders");db.update("DELETE FROM cart_items");db.update("UPDATE products SET stock=50,active=TRUE,price=32 WHERE id=1");
        buyer=db.queryForObject("SELECT id FROM users WHERE email='buyer@harborcart.demo'",Long.class);
        if(db.queryForList("SELECT id FROM users WHERE email='other@test.dev'").isEmpty())auth.register(new Register("other@test.dev","OtherPass123!","Other"));
        other=db.queryForObject("SELECT id FROM users WHERE email='other@test.dev'",Long.class);
    }
    Checkout input(String key){return new Checkout(key,"EUR","DE","Alex","Berlin 10115, Example street 1");}
    long id(Map<String,Object> order){return ((Number)order.get("id")).longValue();}
    int stock(){return db.queryForObject("SELECT stock FROM products WHERE id=1",Integer.class);}
    @Test void quoteAndSnapshotsAreServerCalculated(){shop.changeCart(buyer,1,2);var q=shop.quote(buyer,"EUR","DE");assertEquals(new BigDecimal("72.68"),q.get("total"));var order=shop.checkout(buyer,input("a"));assertEquals(new BigDecimal("72.68"),order.get("total"));assertEquals(48,stock());db.update("UPDATE products SET price=99 WHERE id=1");assertEquals(new BigDecimal("72.68"),shop.order(buyer,id(order),false).get("total"));}
    @Test void freeShippingUsesUsdThreshold(){shop.changeCart(buyer,1,4);assertEquals(new BigDecimal("0.00"),shop.quote(buyer,"GBP","GB").get("shipping"));}
    @Test void duplicateCheckoutReturnsSameOrder(){shop.changeCart(buyer,1,2);var first=shop.checkout(buyer,input("same"));var second=shop.checkout(buyer,input("same"));assertEquals(id(first),id(second));assertEquals(48,stock());assertTrue(shop.cart(buyer).isEmpty());}
    @Test void cancelRestoresStockOnce(){shop.changeCart(buyer,1,2);long id=id(shop.checkout(buyer,input("cancel")));shop.cancel(buyer,id);shop.cancel(buyer,id);assertEquals(50,stock());assertThrows(ApiException.class,()->shop.pay(buyer,id));}
    @Test void invalidStateAndOwnershipAreRejected(){shop.changeCart(buyer,1,1);long id=id(shop.checkout(buyer,input("paid")));assertThrows(ApiException.class,()->shop.ship(id,"TRACK"));assertThrows(ApiException.class,()->shop.pay(other,id));shop.pay(buyer,id);assertThrows(ApiException.class,()->shop.cancel(buyer,id));shop.ship(id,"TRACK123");assertEquals("SHIPPED",shop.order(buyer,id,false).get("status"));}
    @Test void stockFailureRollsBackWholeCheckout(){shop.changeCart(buyer,1,2);shop.changeCart(buyer,2,1);db.update("UPDATE products SET stock=0 WHERE id=2");assertThrows(ApiException.class,()->shop.checkout(buyer,input("rollback")));assertEquals(50,stock());assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM shop_orders",Integer.class));assertEquals(2,shop.cart(buyer).size());db.update("UPDATE products SET stock=50 WHERE id=2");}
    @Test void competingBuyersCannotOversell()throws Exception{db.update("UPDATE products SET stock=1 WHERE id=1");shop.changeCart(buyer,1,1);shop.changeCart(other,1,1);var pool=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);try{var tasks=new ArrayList<Future<Boolean>>();for(long user:List.of(buyer,other))tasks.add(pool.submit(()->{start.await();try{shop.checkout(user,input("race"));return true;}catch(ApiException e){return false;}}));start.countDown();int successes=0;for(var task:tasks)if(task.get(10,TimeUnit.SECONDS))successes++;assertEquals(1,successes);assertEquals(0,stock());}finally{pool.shutdownNow();}}
    @Test void apiRequiresAuthAndAdminRole()throws Exception{mvc.perform(get("/api/cart")).andExpect(status().isUnauthorized());String token=auth.login(new Login("buyer@harborcart.demo","BuyerDemo123!")).get("token").toString();mvc.perform(get("/api/admin/products").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());mvc.perform(put("/api/cart/1").header("Authorization","Bearer "+token).contentType("application/json").content("{\"quantity\":-1}")).andExpect(status().isBadRequest());}
    @Test void unsupportedCurrenciesAndEmptyCartFail(){assertThrows(ApiException.class,()->shop.quote(buyer,"CNY","CN"));assertThrows(ApiException.class,()->shop.checkout(buyer,input("empty")));}
    @Test void tokensAreRevokedOnLogout(){String token=auth.login(new Login("buyer@harborcart.demo","BuyerDemo123!")).get("token").toString();assertEquals(buyer,auth.authenticate("Bearer "+token).id());auth.logout("Bearer "+token);assertThrows(ApiException.class,()->auth.authenticate("Bearer "+token));}
}
