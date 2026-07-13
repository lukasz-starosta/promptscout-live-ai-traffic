<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class PromptScout_Live_AI_Traffic_Plugin {
	private PromptScout_Live_AI_Traffic_Settings $settings;
	private PromptScout_Live_AI_Traffic_Classifier $classifier;
	private PromptScout_Live_AI_Traffic_Event_Builder $event_builder;
	private ?array $pending_delivery = null;

	public function __construct(
		PromptScout_Live_AI_Traffic_Settings $settings,
		PromptScout_Live_AI_Traffic_Classifier $classifier,
		PromptScout_Live_AI_Traffic_Event_Builder $event_builder
	) {
		$this->settings      = $settings;
		$this->classifier    = $classifier;
		$this->event_builder = $event_builder;
	}

	public function register(): void {
		$this->settings->register();
		add_action( 'template_redirect', [ $this, 'track_request' ], 0 );
		add_action( 'shutdown', [ $this, 'flush_pending_delivery' ], 0 );
	}

	public function track_request(): void {
		if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}

		$options = $this->settings->get_options();
		if ( '' === $options['ingest_url'] || '' === $options['ingest_token'] ) {
			$this->debug_log( $options, 'PromptScout Live AI Traffic is not configured.' );
			return;
		}

		$classification = $this->classifier->classify(
			$_SERVER['HTTP_USER_AGENT'] ?? null,
			$_SERVER['HTTP_REFERER'] ?? null,
			$this->classification_query_source( $_SERVER['REQUEST_URI'] ?? null )
		);

		if ( 'other' === $classification['provider'] ) {
			$this->debug_log( $options, 'PromptScout skipped request with unknown AI traffic classification.' );
			return;
		}

		$event = $this->event_builder->build( $_SERVER, $classification, $options['privacy_mode'] );
		$this->pending_delivery = [
			'options' => $options,
			'event'   => $event,
		];
	}

	public function flush_pending_delivery(): void {
		if ( null === $this->pending_delivery ) {
			return;
		}

		$delivery = $this->pending_delivery;
		$this->pending_delivery = null;
		$options = $delivery['options'];
		$event   = $delivery['event'];

		$response = wp_safe_remote_post(
			$options['ingest_url'],
			[
				'headers'     => [
					'Authorization' => 'Bearer ' . $options['ingest_token'],
					'Content-Type'  => 'application/json',
				],
				'body'        => wp_json_encode(
					[
						'events' => [ $event ],
					]
				),
				'timeout'     => 2,
				'blocking'    => false,
				'data_format' => 'body',
			]
		);

		if ( is_wp_error( $response ) ) {
			$this->debug_log( $options, 'PromptScout ingest request failed: ' . $response->get_error_message() );
		}
	}

	private function classification_query_source( ?string $request_uri ): ?string {
		$query = is_string( $request_uri ) ? wp_parse_url( $request_uri, PHP_URL_QUERY ) : null;
		if ( ! is_string( $query ) || '' === $query ) {
			return null;
		}

		$safe_pairs = [];
		foreach ( explode( '&', $query ) as $pair ) {
			if ( '' === $pair ) {
				continue;
			}

			$equals_index = strpos( $pair, '=' );
			$raw_key      = false === $equals_index ? $pair : substr( $pair, 0, $equals_index );
			$raw_value    = false === $equals_index ? '' : substr( $pair, $equals_index + 1 );
			$key          = strtolower( urldecode( str_replace( '+', ' ', $raw_key ) ) );

			if ( ! in_array( $key, [ 'utm_source', 'source' ], true ) ) {
				continue;
			}

			$value = trim( urldecode( str_replace( '+', ' ', $raw_value ) ) );
			if ( '' === $value ) {
				continue;
			}

			$safe_pairs[] = rawurlencode( $key ) . '=' . rawurlencode( $value );
		}

		return [] === $safe_pairs ? null : '?' . implode( '&', $safe_pairs );
	}

	private function debug_log( array $options, string $message ): void {
		if ( '1' !== ( $options['debug_mode'] ?? '0' ) ) {
			return;
		}

		error_log( $message );
	}
}
