package com.traceai.sdk.spring.boot;

import com.traceai.sdk.TraceLogClient;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.util.StringUtils;

import java.time.Duration;

@AutoConfiguration
@ConditionalOnClass(TraceLogClient.class)
@EnableConfigurationProperties(TraceLogProperties.class)
public class TraceLogAutoConfiguration {
    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "trace.log", name = "enabled", havingValue = "true", matchIfMissing = true)
    public TraceLogClient traceLogClient(TraceLogProperties properties) {
        if (!StringUtils.hasText(properties.getPlatformBaseUrl())) {
            throw new IllegalArgumentException("trace.log.platform-base-url is required");
        }
        if (!StringUtils.hasText(properties.getServiceName())) {
            throw new IllegalArgumentException("trace.log.service-name is required");
        }

        return TraceLogClient.builder()
            .baseUrl(properties.getPlatformBaseUrl())
            .serviceName(properties.getServiceName())
            .source(properties.getSource())
            .batchSize(properties.getBatchSize())
            .maxQueueSize(properties.getMaxQueueSize())
            .flushInterval(Duration.ofMillis(properties.getFlushIntervalMs()))
            .requestTimeout(Duration.ofMillis(properties.getRequestTimeoutMs()))
            .failSilently(properties.isFailSilently())
            .build();
    }

    @Bean
    @ConditionalOnBean(TraceLogClient.class)
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "trace.log", name = "enabled", havingValue = "true", matchIfMissing = true)
    public FilterRegistrationBean<TraceLogWebFilter> traceLogFilterRegistration(TraceLogClient client) {
        FilterRegistrationBean<TraceLogWebFilter> registration = new FilterRegistrationBean<>();
        registration.setName("traceLogWebFilter");
        registration.setFilter(new TraceLogWebFilter(client));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 20);
        registration.addUrlPatterns("/*");
        return registration;
    }
}
