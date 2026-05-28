<?php
/**
 * Plugin Name: PromptScout Live AI Traffic
 * Description: Server-side AI crawler and assistant referral tracking for PromptScout.
 * Version: 0.1.0
 * Author: PromptScout
 * License: Apache-2.0
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PROMPTSCOUT_LIVE_AI_TRAFFIC_PLUGIN_FILE', __FILE__ );
define( 'PROMPTSCOUT_LIVE_AI_TRAFFIC_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

require_once PROMPTSCOUT_LIVE_AI_TRAFFIC_PLUGIN_DIR . 'includes/class-promptscout-live-ai-traffic-classifier.php';
require_once PROMPTSCOUT_LIVE_AI_TRAFFIC_PLUGIN_DIR . 'includes/class-promptscout-live-ai-traffic-event-builder.php';
require_once PROMPTSCOUT_LIVE_AI_TRAFFIC_PLUGIN_DIR . 'includes/class-promptscout-live-ai-traffic-settings.php';
require_once PROMPTSCOUT_LIVE_AI_TRAFFIC_PLUGIN_DIR . 'includes/class-promptscout-live-ai-traffic-plugin.php';

function promptscout_live_ai_traffic_bootstrap(): void {
	$settings = new PromptScout_Live_AI_Traffic_Settings();
	$plugin   = new PromptScout_Live_AI_Traffic_Plugin(
		$settings,
		new PromptScout_Live_AI_Traffic_Classifier(),
		new PromptScout_Live_AI_Traffic_Event_Builder()
	);
	$plugin->register();
}

add_action( 'plugins_loaded', 'promptscout_live_ai_traffic_bootstrap' );
