<?php
/**
 * Plugin Name: ElectrikJam Headless Export
 * Description: Read-only JSON export endpoint for the Astro/Cloudflare front end.
 * Version: 0.1.0
 */

add_action('rest_api_init', function () {
    register_rest_route('electrikjam/v1', '/export', [
        'methods' => 'GET',
        'callback' => 'ej_headless_export_response',
        'permission_callback' => 'ej_headless_export_can_read',
    ]);
});

function ej_headless_export_can_read(WP_REST_Request $request) {
    $configured_token = defined('EJ_HEADLESS_EXPORT_TOKEN')
        ? EJ_HEADLESS_EXPORT_TOKEN
        : getenv('EJ_HEADLESS_EXPORT_TOKEN');

    if (!$configured_token) {
        return current_user_can('manage_options');
    }

    $header = $request->get_header('authorization');
    $provided_token = preg_replace('/^Bearer\s+/i', '', $header ?: '');
    if (!$provided_token) {
        $provided_token = $request->get_param('token') ?: '';
    }

    return hash_equals((string) $configured_token, (string) $provided_token);
}

function ej_headless_export_response(WP_REST_Request $request) {
    $post_limit = $request->get_param('post_limit');
    $page_limit = $request->get_param('page_limit');

    return rest_ensure_response([
        'generatedAt' => gmdate('c'),
        'home' => home_url('/'),
        'siteurl' => site_url('/'),
        'permalinkStructure' => get_option('permalink_structure'),
        'categories' => ej_headless_all_terms('category'),
        'tags' => ej_headless_all_terms('post_tag'),
        'posts' => ej_headless_query_posts('post', $post_limit === null ? -1 : (int) $post_limit),
        'pages' => ej_headless_query_posts('page', $page_limit === null ? -1 : (int) $page_limit),
    ]);
}

function ej_headless_query_posts($post_type, $limit) {
    $query = new WP_Query([
        'post_type' => $post_type,
        'post_status' => 'publish',
        'posts_per_page' => $limit,
        'orderby' => 'date',
        'order' => 'DESC',
        'ignore_sticky_posts' => true,
    ]);

    return array_map('ej_headless_post_payload', $query->posts);
}

function ej_headless_post_payload($post) {
    $author_id = (int) $post->post_author;
    $thumbnail_id = get_post_thumbnail_id($post);
    $featured_image = '';
    $featured_image_alt = '';

    if ($thumbnail_id) {
        $featured_image = wp_get_attachment_url($thumbnail_id) ?: '';
        $featured_image_alt = get_post_meta($thumbnail_id, '_wp_attachment_image_alt', true) ?: get_the_title($thumbnail_id);
    }

    return [
        'id' => $post->ID,
        'type' => $post->post_type,
        'slug' => $post->post_name,
        'path' => wp_parse_url(get_permalink($post), PHP_URL_PATH),
        'url' => get_permalink($post),
        'title' => html_entity_decode(get_the_title($post), ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'excerpt' => apply_filters('the_excerpt', get_the_excerpt($post)),
        'date' => get_gmt_from_date($post->post_date, 'c'),
        'modified' => get_gmt_from_date($post->post_modified, 'c'),
        'author' => [
            'id' => $author_id,
            'name' => get_the_author_meta('display_name', $author_id),
            'slug' => get_the_author_meta('user_nicename', $author_id),
        ],
        'categories' => ej_headless_term_payload($post->ID, 'category'),
        'tags' => ej_headless_term_payload($post->ID, 'post_tag'),
        'featuredImage' => $featured_image,
        'featuredImageAlt' => html_entity_decode($featured_image_alt, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'seo' => [
            'title' => ej_headless_meta_first($post->ID, ['_yoast_wpseo_title', 'rank_math_title']),
            'description' => ej_headless_meta_first($post->ID, ['_yoast_wpseo_metadesc', 'rank_math_description']),
            'canonical' => ej_headless_meta_first($post->ID, ['_yoast_wpseo_canonical', 'rank_math_canonical_url']),
        ],
        'content' => apply_filters('the_content', $post->post_content),
    ];
}

function ej_headless_term_payload($post_id, $taxonomy) {
    $terms = get_the_terms($post_id, $taxonomy);
    if (is_wp_error($terms) || empty($terms)) {
        return [];
    }

    return array_values(array_map('ej_headless_format_term', $terms));
}

function ej_headless_all_terms($taxonomy) {
    $terms = get_terms([
        'taxonomy' => $taxonomy,
        'hide_empty' => false,
    ]);
    if (is_wp_error($terms) || empty($terms)) {
        return [];
    }

    return array_values(array_map('ej_headless_format_term', $terms));
}

function ej_headless_format_term($term) {
    $link = get_term_link($term);
    $path = is_wp_error($link) ? '' : wp_parse_url($link, PHP_URL_PATH);

    return [
        'id' => $term->term_id,
        'name' => html_entity_decode($term->name, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'slug' => $term->slug,
        'taxonomy' => $term->taxonomy,
        'parent' => (int) $term->parent,
        'description' => html_entity_decode(term_description($term), ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'path' => $path,
        'link' => is_wp_error($link) ? '' : $link,
        'seo' => [
            'title' => ej_headless_term_meta_first($term->term_id, ['wpseo_title', 'rank_math_title']),
            'description' => ej_headless_term_meta_first($term->term_id, ['wpseo_desc', 'rank_math_description']),
            'canonical' => ej_headless_term_meta_first($term->term_id, ['wpseo_canonical', 'rank_math_canonical_url']),
        ],
    ];
}

function ej_headless_meta_first($post_id, $keys) {
    foreach ($keys as $key) {
        $value = get_post_meta($post_id, $key, true);
        if ($value !== '') {
            return $value;
        }
    }
    return '';
}

function ej_headless_term_meta_first($term_id, $keys) {
    foreach ($keys as $key) {
        $value = get_term_meta($term_id, $key, true);
        if ($value !== '') {
            return $value;
        }
    }
    return '';
}
