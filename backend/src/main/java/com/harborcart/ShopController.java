package com.harborcart;

import static com.harborcart.Models.*;
import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ShopController {
    private final AuthService auth;private final ShopService shop;private final CatalogCache catalog;private final boolean demo;
    public ShopController(AuthService auth,ShopService shop,CatalogCache catalog,@Value("${app.demo}")boolean demo){this.auth=auth;this.shop=shop;this.catalog=catalog;this.demo=demo;}
    @GetMapping("/config") Object config(){return Map.of("rates",ShopService.RATES,"countries",List.of("US","DE","GB"),"demo",demo,"rateNote","固定演示汇率，非实时牌价；不含进口关税");}
    @PostMapping("/auth/login") Object login(@Valid @RequestBody Login body){return auth.login(body);}
    @PostMapping("/auth/register") Object register(@Valid @RequestBody Register body){return auth.register(body);}
    @GetMapping("/auth/me") Object me(HttpServletRequest req){return user(req);}
    @PostMapping("/auth/logout") void logout(HttpServletRequest req){auth.logout(req.getHeader("Authorization"));}
    @GetMapping("/products") Object products(){return catalog.products();}
    @GetMapping("/cart") Object cart(HttpServletRequest req){return shop.cart(user(req).id());}
    @PutMapping("/cart/{id}") void cart(HttpServletRequest req,@PathVariable long id,@Valid @RequestBody CartChange body){shop.changeCart(user(req).id(),id,body.quantity());}
    @GetMapping("/quote") Object quote(HttpServletRequest req,@RequestParam String currency,@RequestParam String country){return shop.quote(user(req).id(),currency,country);}
    @PostMapping("/orders") Object checkout(HttpServletRequest req,@Valid @RequestBody Checkout body){return shop.checkout(user(req).id(),body);}
    @GetMapping("/orders") Object orders(HttpServletRequest req){return shop.orders(user(req).id(),false);}
    @PostMapping("/orders/{id}/cancel") void cancel(HttpServletRequest req,@PathVariable long id){shop.cancel(user(req).id(),id);}
    @PostMapping("/orders/{id}/pay") void pay(HttpServletRequest req,@PathVariable long id){if(!demo)throw new ApiException(403,"模拟付款未开启");shop.pay(user(req).id(),id);}
    @GetMapping("/admin/products") Object adminProducts(HttpServletRequest req){admin(req);return shop.adminProducts();}
    @PostMapping("/admin/products") void create(HttpServletRequest req,@Valid @RequestBody Product body){admin(req);shop.saveProduct(null,body);}
    @PutMapping("/admin/products/{id}") void save(HttpServletRequest req,@PathVariable long id,@Valid @RequestBody Product body){admin(req);shop.saveProduct(id,body);}
    @GetMapping("/admin/orders") Object adminOrders(HttpServletRequest req){admin(req);return shop.orders(0,true);}
    @PostMapping("/admin/orders/{id}/ship") void ship(HttpServletRequest req,@PathVariable long id,@Valid @RequestBody Shipment body){admin(req);shop.ship(id,body.tracking());}
    @GetMapping("/admin/dashboard") Object dashboard(HttpServletRequest req){admin(req);return shop.dashboard();}
    private User user(HttpServletRequest req){return (User)req.getAttribute("user");}
    private void admin(HttpServletRequest req){if(!"ADMIN".equals(user(req).role()))throw new ApiException(403,"需要管理员权限");}
}
