<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class PromptScout_Live_AI_Traffic_Classifier {
	private array $rules;

	public function __construct( ?array $rules = null ) {
		$this->rules = $rules ?? $this->load_rules();
	}

	public function classify( ?string $user_agent, ?string $referer, ?string $landing_query_source = null ): array {
		$user_agent_result = $this->classify_value( $user_agent, $this->rules['userAgentRules'] ?? [], 'fallback:unknown-user-agent' );
		$referer_result    = $this->classify_value( $referer, $this->rules['refererRules'] ?? [], 'fallback:unknown-referer' );
		$query_result      = $this->classify_landing_query( $landing_query_source );

		$selected = null;
		foreach ( [ $user_agent_result, $referer_result, $query_result ] as $result ) {
			if ( ! $this->is_known( $result ) ) {
				continue;
			}

			if ( null === $selected || $result['confidence'] > $selected['confidence'] ) {
				$selected = $result;
			}
		}

		return $selected ?? $this->unknown_classification( 'fallback:unknown-request' );
	}

	private function classify_value( ?string $value, array $rules, string $fallback_rule ): array {
		$value = is_string( $value ) ? trim( $value ) : '';

		if ( '' === $value ) {
			return $this->unknown_classification( $fallback_rule );
		}

		foreach ( $rules as $rule ) {
			foreach ( $rule['patterns'] ?? [] as $pattern ) {
				$delimiter = '~';
				$source    = str_replace( $delimiter, '\\' . $delimiter, (string) ( $pattern['source'] ?? '' ) );
				$flags     = preg_replace( '/[^i]/', '', (string) ( $pattern['flags'] ?? '' ) );

				if ( '' !== $source && 1 === preg_match( $delimiter . $source . $delimiter . $flags, $value ) ) {
					return [
						'provider'    => $rule['provider'],
						'agentType'   => $rule['agentType'],
						'confidence'  => $rule['confidence'],
						'matchedRule' => $rule['id'],
						'matchedBy'   => [ $rule['matchKind'] ],
					];
				}
			}
		}

		return $this->unknown_classification( $fallback_rule );
	}

	private function classify_landing_query( ?string $query_source ): array {
		$query_source = is_string( $query_source ) ? trim( $query_source ) : '';

		if ( '' === $query_source ) {
			return $this->unknown_classification( 'fallback:unknown-query' );
		}

		$query_index = strpos( $query_source, '?' );
		if ( 0 === $query_index ) {
			$body = substr( $query_source, 1 );
		} elseif ( false !== $query_index ) {
			$body = substr( $query_source, $query_index + 1 );
		} else {
			$body = $query_source;
		}

		$attribution_keys = $this->rules['landingQueryAttributionKeys'] ?? [ 'utm_source', 'source' ];
		foreach ( explode( '&', $body ) as $pair ) {
			if ( '' === $pair ) {
				continue;
			}

			$equals_index = strpos( $pair, '=' );
			$raw_key      = false === $equals_index ? $pair : substr( $pair, 0, $equals_index );
			$raw_value    = false === $equals_index ? '' : substr( $pair, $equals_index + 1 );
			$key          = strtolower( $this->decode_query_component( $raw_key ) );

			if ( ! in_array( $key, $attribution_keys, true ) ) {
				continue;
			}

			$result = $this->classify_value(
				$this->normalize_query_attribution_value( $this->decode_query_component( $raw_value ) ),
				$this->rules['landingQueryAttributionRules'] ?? [],
				'fallback:unknown-query'
			);

			if ( $this->is_known( $result ) ) {
				return $result;
			}
		}

		return $this->unknown_classification( 'fallback:unknown-query' );
	}

	private function decode_query_component( string $value ): string {
		return urldecode( str_replace( '+', ' ', $value ) );
	}

	private function normalize_query_attribution_value( string $value ): string {
		$value = strtolower( trim( $value ) );
		$value = preg_replace( '/^[a-z][a-z0-9+.-]*:\/\/+/i', '', $value ) ?? $value;
		$value = preg_replace( '/^www\./i', '', $value ) ?? $value;
		$value = preg_split( '/[\/?#]/', $value, 2 )[0] ?? $value;

		return preg_replace( '/[^a-z0-9]+/', '', $value ) ?? '';
	}

	private function load_rules(): array {
		$path = PROMPTSCOUT_LIVE_AI_TRAFFIC_PLUGIN_DIR . 'includes/classifier-rules.json';
		$json = file_exists( $path ) ? file_get_contents( $path ) : false;

		if ( false === $json ) {
			return [
				'userAgentRules'                => [],
				'refererRules'                  => [],
				'landingQueryAttributionKeys'   => [],
				'landingQueryAttributionRules'  => [],
			];
		}

		$rules = json_decode( $json, true );

		return is_array( $rules ) ? $rules : [
			'userAgentRules'                => [],
			'refererRules'                  => [],
			'landingQueryAttributionKeys'   => [],
			'landingQueryAttributionRules'  => [],
		];
	}

	private function unknown_classification( string $matched_rule ): array {
		return [
			'provider'    => 'other',
			'agentType'   => 'other',
			'confidence'  => 0,
			'matchedRule' => $matched_rule,
			'matchedBy'   => [ 'other' ],
		];
	}

	private function is_known( array $classification ): bool {
		return 'other' !== $classification['provider'] && 'other' !== $classification['agentType'];
	}
}
