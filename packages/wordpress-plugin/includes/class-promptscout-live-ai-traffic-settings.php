<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class PromptScout_Live_AI_Traffic_Settings {
	public const OPTION_NAME = 'promptscout_live_ai_traffic_options';

	public function register(): void {
		add_action( 'admin_menu', [ $this, 'register_admin_page' ] );
		add_action( 'admin_init', [ $this, 'register_settings' ] );
	}

	public function register_admin_page(): void {
		add_options_page(
			'PromptScout Live AI Traffic',
			'PromptScout AI Traffic',
			'manage_options',
			'promptscout-live-ai-traffic',
			[ $this, 'render_settings_page' ]
		);
	}

	public function register_settings(): void {
		register_setting(
			'promptscout_live_ai_traffic',
			self::OPTION_NAME,
			[
				'type'              => 'array',
				'sanitize_callback' => [ $this, 'sanitize_options' ],
				'default'           => $this->default_options(),
			]
		);
	}

	public function get_options(): array {
		$options = get_option( self::OPTION_NAME, [] );

		return array_merge( $this->default_options(), is_array( $options ) ? $options : [] );
	}

	public function sanitize_options( $input ): array {
		$input   = is_array( $input ) ? $input : [];
		$options = $this->default_options();

		$options['ingest_url'] = isset( $input['ingest_url'] )
			? esc_url_raw( trim( (string) $input['ingest_url'] ) )
			: '';
		$options['ingest_token'] = isset( $input['ingest_token'] )
			? sanitize_text_field( (string) $input['ingest_token'] )
			: '';
		$options['privacy_mode'] = $this->sanitize_choice(
			$input['privacy_mode'] ?? '',
			[ 'disabled', 'omit', 'hash' ],
			'disabled'
		);
		$options['debug_mode'] = ! empty( $input['debug_mode'] ) ? '1' : '0';

		return $options;
	}

	public function render_settings_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$options = $this->get_options();
		?>
		<div class="wrap">
			<h1><?php echo esc_html__( 'PromptScout Live AI Traffic', 'promptscout-live-ai-traffic' ); ?></h1>
			<form method="post" action="options.php">
				<?php settings_fields( 'promptscout_live_ai_traffic' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row">
							<label for="promptscout-live-ai-traffic-ingest-url"><?php echo esc_html__( 'Ingest URL', 'promptscout-live-ai-traffic' ); ?></label>
						</th>
						<td>
							<input
								id="promptscout-live-ai-traffic-ingest-url"
								class="regular-text code"
								type="url"
								name="<?php echo esc_attr( self::OPTION_NAME ); ?>[ingest_url]"
								value="<?php echo esc_attr( $options['ingest_url'] ); ?>"
								autocomplete="off"
							/>
						</td>
					</tr>
					<tr>
						<th scope="row">
							<label for="promptscout-live-ai-traffic-ingest-token"><?php echo esc_html__( 'Ingest token', 'promptscout-live-ai-traffic' ); ?></label>
						</th>
						<td>
							<input
								id="promptscout-live-ai-traffic-ingest-token"
								class="regular-text"
								type="password"
								name="<?php echo esc_attr( self::OPTION_NAME ); ?>[ingest_token]"
								value="<?php echo esc_attr( $options['ingest_token'] ); ?>"
								autocomplete="new-password"
							/>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php echo esc_html__( 'Privacy mode', 'promptscout-live-ai-traffic' ); ?></th>
						<td>
							<select name="<?php echo esc_attr( self::OPTION_NAME ); ?>[privacy_mode]">
								<option value="disabled" <?php selected( $options['privacy_mode'], 'disabled' ); ?>><?php echo esc_html__( 'Do not collect IP addresses', 'promptscout-live-ai-traffic' ); ?></option>
								<option value="omit" <?php selected( $options['privacy_mode'], 'omit' ); ?>><?php echo esc_html__( 'Omit IP metadata', 'promptscout-live-ai-traffic' ); ?></option>
								<option value="hash" <?php selected( $options['privacy_mode'], 'hash' ); ?>><?php echo esc_html__( 'Hash visitor IP addresses', 'promptscout-live-ai-traffic' ); ?></option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php echo esc_html__( 'Debug mode', 'promptscout-live-ai-traffic' ); ?></th>
						<td>
							<label>
								<input
									type="checkbox"
									name="<?php echo esc_attr( self::OPTION_NAME ); ?>[debug_mode]"
									value="1"
									<?php checked( $options['debug_mode'], '1' ); ?>
								/>
								<?php echo esc_html__( 'Log skipped requests and delivery errors to the WordPress debug log.', 'promptscout-live-ai-traffic' ); ?>
							</label>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}

	private function default_options(): array {
		return [
			'ingest_url'   => '',
			'ingest_token' => '',
			'privacy_mode' => 'disabled',
			'debug_mode'   => '0',
		];
	}

	private function sanitize_choice( $value, array $allowed, string $fallback ): string {
		$value = sanitize_key( (string) $value );

		return in_array( $value, $allowed, true ) ? $value : $fallback;
	}
}
