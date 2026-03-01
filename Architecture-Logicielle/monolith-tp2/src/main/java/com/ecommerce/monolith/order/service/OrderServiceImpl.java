package com.ecommerce.monolith.order.service;

import com.ecommerce.monolith.order.dto.CreateOrderItemRequest;
import com.ecommerce.monolith.order.dto.CreateOrderRequest;
import com.ecommerce.monolith.order.dto.OrderDTO;
import com.ecommerce.monolith.order.mapper.OrderMapper;
import com.ecommerce.monolith.order.model.Order;
import com.ecommerce.monolith.order.model.OrderItem;
import com.ecommerce.monolith.order.repository.OrderRepository;
import com.ecommerce.monolith.customer.service.CustomerService;
import com.ecommerce.monolith.product.dto.ProductDTO;
import com.ecommerce.monolith.product.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final OrderMapper orderMapper;
    private final CustomerService customerService;
    private final ProductService productService;

    @Override
    @Transactional(readOnly = true)
    public OrderDTO getOrderById(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found with id: " + id));
        return orderMapper.toDTO(order);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderDTO> getOrdersByCustomer(Long customerId) {
        if (!customerService.existsById(customerId)) {
            throw new RuntimeException("Customer not found with id: " + customerId);
        }
        return orderMapper.toDTOList(orderRepository.findByCustomerId(customerId));
    }

    @Override
    public OrderDTO createOrder(CreateOrderRequest request) {
        // Verify customer
        if (!customerService.existsById(request.getCustomerId())) {
            throw new RuntimeException("Customer not found with id: " + request.getCustomerId());
        }

        Order order = orderMapper.toEntity(request);
        order.setCustomerId(request.getCustomerId());

        List<OrderItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (CreateOrderItemRequest itemRequest : request.getItems()) {
            ProductDTO product = productService.getProductById(itemRequest.getProductId());

            OrderItem item = OrderItem.builder()
                    .productId(product.getId())
                    .quantity(itemRequest.getQuantity())
                    .price(product.getPrice())
                    .build();
            items.add(item);

            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(itemRequest.getQuantity())));
        }

        order.setItems(items);
        order.setTotalAmount(total);

        Order savedOrder = orderRepository.save(order);
        return orderMapper.toDTO(savedOrder);
    }
}