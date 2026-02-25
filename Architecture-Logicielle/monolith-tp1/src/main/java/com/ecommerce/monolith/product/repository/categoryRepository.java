package com.ecommerce.monolith.product.repository;

import com.ecommerce.monolith.product.model.category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

@RepositoryRestResource(path = "category")

public interface categoryRepository extends JpaRepository<category, Long> {

}