package com.ecommerce.orderservice.client;

import com.ecommerce.orderservice.dto.ProductDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

@FeignClient(name = "product-service")
public interface ProductClient {

    @GetMapping("/api/products/{id}")
    ProductDTO getProductById(@PathVariable Long id);

    // Exercice 1 : appel pour mettre a jour le stock
    @PutMapping("/api/products/{id}/stock")
    ProductDTO updateStock(@PathVariable Long id, @RequestParam Integer quantity);
}
