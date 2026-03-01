package com.ecommerce.monolith.order.mapper;

import com.ecommerce.monolith.order.dto.CreateOrderRequest;
import com.ecommerce.monolith.order.dto.OrderDTO;
import com.ecommerce.monolith.order.dto.OrderItemDTO;
import com.ecommerce.monolith.order.model.Order;
import com.ecommerce.monolith.order.model.OrderItem;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import java.util.List;

@Mapper(componentModel = "spring")
public interface OrderMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "orderDate", expression = "java(java.time.LocalDateTime.now())")
    @Mapping(target = "status", constant = "PENDING")
    @Mapping(target = "totalAmount", ignore = true)
    Order toEntity(CreateOrderRequest request);

    OrderDTO toDTO(Order order);

    List<OrderDTO> toDTOList(List<Order> orders);

    OrderItemDTO toItemDTO(OrderItem item);
}