# TP4 - Architecture SOA E-Commerce

## Structure du projet

```
soa-ecommerce/
├── eureka-server/      (port 8761) - Annuaire des services
├── product-service/    (port 8081) - Gestion des produits
├── order-service/      (port 8082) - Gestion des commandes
└── api-gateway/        (port 8080) - Point d'entrée unique
```

## Ordre de démarrage (IMPORTANT)

1. eureka-server
2. product-service
3. order-service
4. api-gateway

Dans chaque dossier : `mvn spring-boot:run`

## Tests Postman

### Créer un produit
POST http://localhost:8081/api/products
Content-Type: application/json
{
  "name": "Laptop",
  "description": "Ordinateur portable haute performance",
  "price": 1200.00,
  "stock": 10
}

### Lister les produits
GET http://localhost:8081/api/products

### Créer une commande (décrémente le stock automatiquement)
POST http://localhost:8082/api/orders?productId=1&quantity=2

### Lister les commandes
GET http://localhost:8082/api/orders

### Mettre à jour le stock manuellement (Exercice 1)
PUT http://localhost:8081/api/products/1/stock?quantity=3

### Via l'API Gateway (Exercice 2)
GET http://localhost:8080/products
GET http://localhost:8080/orders
POST http://localhost:8080/orders?productId=1&quantity=1

### Vérifier Eureka
http://localhost:8761
```

## Exercices réalisés

- Exercice 1 : endpoint PUT /api/products/{id}/stock + appel automatique depuis Order Service
- Exercice 2 : API Gateway avec routes vers Product et Order Service
- Exercice 3 : gestion des erreurs (produit inexistant, stock insuffisant, service indisponible)
