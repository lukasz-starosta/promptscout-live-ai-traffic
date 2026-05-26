<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class PromptScout_Live_AI_Traffic_Event_Builder {
	private const SUPPORTED_METHODS = [
		'GET',
		'POST',
		'PUT',
		'PATCH',
		'DELETE',
		'HEAD',
		'OPTIONS',
	];

	public function build( array $server, array $classification, string $privacy_mode ): array {
		$request_uri = $this->server_value( $server, 'REQUEST_URI' ) ?? '/';
		$path        = wp_parse_url( $request_uri, PHP_URL_PATH );
		$query       = wp_parse_url( $request_uri, PHP_URL_QUERY );
		$user_agent  = $this->server_value( $server, 'HTTP_USER_AGENT' );
		$referer     = $this->server_value( $server, 'HTTP_REFERER' );

		$event = [
			'schemaVersion'          => 1,
			'eventKind'              => 'request_observation',
			'sourceProvider'         => 'wordpress',
			'observedAt'             => gmdate( 'c' ),
			'request'                => array_filter(
				[
					'host'      => $this->host( $server ),
					'path'      => $this->path( $path ),
					'search'    => is_string( $query ) && '' !== $query ? '?' . $query : null,
					'method'    => $this->method( $this->server_value( $server, 'REQUEST_METHOD' ) ),
					'userAgent' => $user_agent,
					'referer'   => $referer,
				],
				static fn( $value ) => null !== $value
			),
			'providerClassification' => [
				'provider'   => $classification['provider'],
				'agentType'  => $classification['agentType'],
				'confidence' => $classification['confidence'],
				'matchedBy'  => $classification['matchedBy'],
			],
			'integration'            => [
				'name' => 'wordpress-plugin',
			],
		];

		$ip_hash = $this->ip_hash( $server, $privacy_mode );
		if ( null !== $ip_hash ) {
			$event['ipHash'] = $ip_hash;
		}

		return $event;
	}

	private function host( array $server ): string {
		return $this->server_value( $server, 'HTTP_HOST' )
			?? $this->server_value( $server, 'SERVER_NAME' )
			?? 'unknown';
	}

	private function path( $path ): string {
		$path = is_string( $path ) && '' !== $path ? $path : '/';

		return 0 === strpos( $path, '/' ) ? $path : '/' . $path;
	}

	private function method( ?string $method ): string {
		$method = strtoupper( (string) $method );

		return in_array( $method, self::SUPPORTED_METHODS, true ) ? $method : 'OTHER';
	}

	private function ip_hash( array $server, string $privacy_mode ): ?array {
		if ( 'omit' === $privacy_mode ) {
			return null;
		}

		if ( 'hash' !== $privacy_mode ) {
			return [
				'algorithm'           => 'none',
				'originalIpRetention' => 'not_collected',
			];
		}

		$ip = $this->server_value( $server, 'REMOTE_ADDR' );
		if ( null === $ip ) {
			return null;
		}

		return [
			'algorithm'           => 'hmac-sha256',
			'value'               => hash_hmac( 'sha256', $ip, wp_salt( 'auth' ) ),
			'originalIpRetention' => 'discarded_after_hash',
		];
	}

	private function server_value( array $server, string $key ): ?string {
		if ( ! isset( $server[ $key ] ) || ! is_scalar( $server[ $key ] ) ) {
			return null;
		}

		$value = trim( (string) $server[ $key ] );

		return '' === $value ? null : $value;
	}
}
