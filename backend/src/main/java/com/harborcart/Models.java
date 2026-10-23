package com.harborcart;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public final class Models {
    private Models() {}
    public record User(long id, String email, String name, String role) {}
    public record Login(@NotBlank @Email @Size(max=160) String email, @NotBlank @Size(max=72) String password) {}
    public record Register(@NotBlank @Email @Size(max=160) String email, @NotBlank @Size(min=8,max=72) String password, @NotBlank @Size(max=60) String name) {}
    public record CartChange(@Min(0) @Max(99) int quantity) {}
    public record Checkout(@NotBlank @Size(max=80) String requestKey, @NotBlank String currency, @NotBlank String country,
                           @NotBlank @Size(max=80) String recipient, @NotBlank @Size(max=500) String address) {}
    public record Product(@NotBlank @Size(max=120) String name, @NotBlank @Pattern(regexp="Home|Travel|Desk") String category,
                          @NotBlank @Size(max=1200) String description, @NotNull @DecimalMin("0.01") @DecimalMax("999999.99") @Digits(integer=6,fraction=2) BigDecimal price,
                          @Min(0) @Max(1000000) int stock, @NotBlank @Pattern(regexp="/images/(bottle|bag|lamp|cup|pouch|stand)\\.svg") String image, boolean active) {}
    public record Shipment(@NotBlank @Size(max=80) String tracking) {}
}
