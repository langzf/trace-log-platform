# Java SDKs

## Artifacts

- Core SDK: `com.traceai:trace-log-sdk:1.0.0`
- Spring Boot Starter: `com.traceai:trace-log-spring-boot-starter:1.0.0`

## Spring Boot Quick Start

```xml
<dependency>
  <groupId>com.traceai</groupId>
  <artifactId>trace-log-spring-boot-starter</artifactId>
  <version>1.0.0</version>
</dependency>
```

```yaml
trace:
  log:
    platform-base-url: https://trace.example.com
    service-name: order-service
```

The starter auto-registers request tracing filter and async log flush client.
