package com.ecommerce.orderservice.service;

import com.ecommerce.orderservice.client.ProductClient;
import com.ecommerce.orderservice.dto.ProductDTO;
import com.ecommerce.orderservice.model.Order;
import com.ecommerce.orderservice.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final ProductClient productClient;

    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }

    public Order createOrder(Long productId, Integer quantity) {
        // Exercice 3 : gestion erreur si produit inexistant ou service indisponible
        ProductDTO product;
        try {
            product = productClient.getProductById(productId);
        } catch (Exception e) {
            throw new RuntimeException("Produit introuvable ou service Product indisponible");
        }

        // Exercice 1 : decrementer le stock via Product Service
        try {
            productClient.updateStock(productId, quantity);
        } catch (Exception e) {
            throw new RuntimeException("Stock insuffisant ou service Product indisponible : " + e.getMessage());
        }

        Order order = new Order();
        order.setProductId(productId);
        order.setProductName(product.getName());
        order.setQuantity(quantity);
        order.setTotalPrice(product.getPrice() * quantity);
        order.setOrderDate(LocalDateTime.now());
        order.setStatus("PENDING");
        return orderRepository.save(order);
    }
}
