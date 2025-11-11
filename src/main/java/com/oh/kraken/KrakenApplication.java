package com.oh.kraken;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class KrakenApplication {

	public static void main(String[] args) {
		SpringApplication.run(KrakenApplication.class, args);
	}

}
