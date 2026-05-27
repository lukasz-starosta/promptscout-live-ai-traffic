<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class PromptScout_Live_AI_Traffic_Classifier {
	private array $rules;

	public function __construct( ?array $rules = null ) {
		$this->rules = $rules ?? $this->load_rules();
	}

	public function classify( ?string $user_agent, ?string $referer ): array {
		$user_agent_result = $this->classify_value( $user_agent, $this->rules['userAgentRules'] ?? [], 'fallback:unknown-user-agent' );
		$referer_result    = $this->classify_value( $referer, $this->rules['refererRules'] ?? [], 'fallback:unknown-referer' );

		if ( $this->is_known( $user_agent_result ) && $user_agent_result['confidence'] >= $referer_result['confidence'] ) {
			return $user_agent_result;
		}

		if ( $this->is_known( $referer_result ) ) {
			return $referer_result;
		}

		return $this->unknown_classification( 'fallback:unknown-request' );
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

	private function load_rules(): array {
		$path = PROMPTSCOUT_LIVE_AI_TRAFFIC_PLUGIN_DIR . 'includes/classifier-rules.json';
		$json = file_exists( $path ) ? file_get_contents( $path ) : false;

		if ( false === $json ) {
			return [
				'userAgentRules' => [],
				'refererRules'   => [],
			];
		}

		$rules = json_decode( $json, true );

		return is_array( $rules ) ? $rules : [
			'userAgentRules' => [],
			'refererRules'   => [],
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
