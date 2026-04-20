# Spring Boot Integration Example

## 1. Add dependency

```xml
<dependency>
  <groupId>com.traceai</groupId>
  <artifactId>trace-log-spring-boot-starter</artifactId>
  <version>1.0.0</version>
</dependency>
```

## 2. Configure application.yml

```yaml
trace:
  log:
    platform-base-url: https://trace.example.com
    service-name: java-order-service
```

## 3. Run

```bash
mvn spring-boot:run
```

Starter will auto register tracing filter and async log report client.
