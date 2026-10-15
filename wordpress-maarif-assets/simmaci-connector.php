<?php
/**
 * Plugin Name: SIMMACI Live Stats Connector
 * Plugin URI: https://simmaci.com
 * Description: Menghubungkan statistik pendidikan resmi LP Ma'arif NU Cilacap dari SIMMACI (simmaci.com) ke website maarifnucilacap.or.id secara realtime, bebas masalah CORS, dan super cepat.
 * Version: 1.0.0
 * Author: Tim Pengembang LP Ma'arif NU Cilacap
 * Author URI: https://maarifnucilacap.or.id
 * License: GPL-2.0+
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Mengambil data statistik makro dari API SIMMACI dengan caching transien 1 jam
 */
function simmaci_get_cached_macro_stats() {
    $cache_key = 'simmaci_live_stats_cache';
    $stats = get_transient($cache_key);

    if ($stats === false) {
        $api_url = 'https://simmaci.com/api/public/portal/stats';
        $response = wp_remote_get($api_url, [
            'timeout' => 8,
            'headers' => [
                'Accept' => 'application/json',
                'User-Agent' => 'WordPress-Maarif-Portal/1.0',
            ],
        ]);

        if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
            $body = json_decode(wp_remote_retrieve_body($response), true);
            if (isset($body['data']) && is_array($body['data'])) {
                $stats = $body['data'];
                // Simpan cache selama 1 jam (3600 detik)
                set_transient($cache_key, $stats, 3600);
            }
        }
    }

    // Nilai fallback jika API SIMMACI sedang offline/maintenance
    if (!$stats || !is_array($stats)) {
        $stats = [
            'total_schools'  => 207,
            'total_teachers' => 1719,
            'total_tendiks'  => 225,
            'total_students' => 39424,
            'total_districts'=> 24,
            'updated_at'     => current_time('mysql'),
        ];
    }

    return $stats;
}

/**
 * Render Widget Statistik Live (Shortcode: [simmaci_stats])
 */
function simmaci_stats_shortcode($atts) {
    $stats = simmaci_get_cached_macro_stats();

    $schools  = number_format($stats['total_schools'] ?? 207, 0, ',', '.');
    $teachers = number_format($stats['total_teachers'] ?? 1719, 0, ',', '.');
    $tendiks  = number_format($stats['total_tendiks'] ?? 225, 0, ',', '.');
    $students = number_format($stats['total_students'] ?? 39424, 0, ',', '.');

    ob_start();
    ?>
    <div class="simmaci-stats-wrapper">
        <div class="simmaci-stats-badge-container">
            <span class="simmaci-stats-badge">Basis Data Terpadu • SIMMACI</span>
        </div>
        <div class="simmaci-stats-grid">
            <!-- 1. Satuan Pendidikan -->
            <div class="simmaci-stat-card">
                <div class="simmaci-icon-box">🏫</div>
                <div class="simmaci-stat-number"><?php echo esc_html($schools); ?></div>
                <div class="simmaci-stat-title">Madrasah & Sekolah</div>
                <div class="simmaci-stat-sub">MI • MTs • MA • SMK</div>
            </div>

            <!-- 2. Tenaga Pendidik -->
            <div class="simmaci-stat-card">
                <div class="simmaci-icon-box">👨‍🏫</div>
                <div class="simmaci-stat-number"><?php echo esc_html($teachers); ?></div>
                <div class="simmaci-stat-title">Pendidik (Guru)</div>
                <div class="simmaci-stat-sub">Aktif Terdata</div>
            </div>

            <!-- 3. Tenaga Kependidikan -->
            <div class="simmaci-stat-card">
                <div class="simmaci-icon-box">👔</div>
                <div class="simmaci-stat-number"><?php echo esc_html($tendiks); ?></div>
                <div class="simmaci-stat-title">Tenaga Kependidikan</div>
                <div class="simmaci-stat-sub">Staf & Administrasi</div>
            </div>

            <!-- 4. Peserta Didik -->
            <div class="simmaci-stat-card">
                <div class="simmaci-icon-box">🎒</div>
                <div class="simmaci-stat-number"><?php echo esc_html($students); ?></div>
                <div class="simmaci-stat-title">Peserta Didik</div>
                <div class="simmaci-stat-sub">Siswa Terdaftar</div>
            </div>
        </div>
        <div class="simmaci-stats-footer">
            <span>Tersebar di 24 Wilayah Kecamatan se-Kabupaten Cilacap</span>
        </div>
    </div>

    <style>
    .simmaci-stats-wrapper {
        width: 100%;
        max-width: 1200px;
        margin: 25px auto;
        padding: 10px;
        font-family: 'Plus Jakarta Sans', Inter, -apple-system, sans-serif;
        box-sizing: border-box;
    }
    .simmaci-stats-badge-container {
        text-align: center;
        margin-bottom: 18px;
    }
    .simmaci-stats-badge {
        display: inline-block;
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
        padding: 5px 16px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }
    .simmaci-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 20px;
    }
    .simmaci-stat-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 28px 18px;
        text-align: center;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
        transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    }
    .simmaci-stat-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 14px 25px -4px rgba(4, 120, 87, 0.12);
        border-color: #10b981;
    }
    .simmaci-icon-box {
        font-size: 32px;
        margin-bottom: 10px;
    }
    .simmaci-stat-number {
        font-size: 36px;
        font-weight: 900;
        color: #047857;
        line-height: 1.1;
        margin-bottom: 6px;
    }
    .simmaci-stat-title {
        font-size: 14px;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 3px;
    }
    .simmaci-stat-sub {
        font-size: 11px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .simmaci-stats-footer {
        text-align: center;
        margin-top: 18px;
        font-size: 12px;
        font-weight: 600;
        color: #64748b;
    }
    @media (max-width: 640px) {
        .simmaci-stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }
        .simmaci-stat-card {
            padding: 20px 12px;
            border-radius: 16px;
        }
        .simmaci-stat-number {
            font-size: 26px;
        }
        .simmaci-stat-title {
            font-size: 12px;
        }
    }
    </style>
    <?php
    return ob_get_clean();
}
add_shortcode('simmaci_stats', 'simmaci_stats_shortcode');

/**
 * Shortcode untuk Peta Sebaran & Tautan Direktori: [simmaci_peta]
 */
function simmaci_peta_shortcode($atts) {
    ob_start();
    ?>
    <div class="simmaci-map-banner-wrapper">
        <div class="simmaci-map-banner-card">
            <div class="simmaci-map-content">
                <span class="simmaci-map-badge">Visualisasi Geografis</span>
                <h3>Peta Sebaran Madrasah & Sekolah LP Ma'arif NU Cilacap</h3>
                <p>Jelajahi sebaran geografis 207+ satuan pendidikan formal serta persebaran pendidik dan siswa di 24 wilayah kecamatan.</p>
                <div class="simmaci-map-actions">
                    <a href="https://simmaci.com/#sebaran" target="_blank" rel="noopener noreferrer" class="simmaci-btn-primary">
                        Buka Peta Interaktif
                    </a>
                    <a href="https://simmaci.com/#direktori" target="_blank" rel="noopener noreferrer" class="simmaci-btn-secondary">
                        Cari Direktori Madrasah
                    </a>
                </div>
            </div>
        </div>
    </div>
    <style>
    .simmaci-map-banner-wrapper { width: 100%; max-width: 1200px; margin: 30px auto; padding: 10px; box-sizing: border-box; }
    .simmaci-map-banner-card { background: linear-gradient(135deg, #022c22 0%, #064e3b 50%, #0f172a 100%); border-radius: 24px; padding: 45px 35px; color: #ffffff; text-align: center; box-shadow: 0 10px 25px -5px rgba(2, 44, 34, 0.3); border: 1px solid rgba(16, 185, 129, 0.25); }
    .simmaci-map-badge { display: inline-block; background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(110, 231, 183, 0.4); padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px; }
    .simmaci-map-content h3 { color: #ffffff; font-size: 26px; font-weight: 800; margin: 0 0 10px 0; }
    .simmaci-map-content p { color: #cbd5e1; font-size: 15px; max-width: 680px; margin: 0 auto 25px auto; line-height: 1.6; }
    .simmaci-map-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
    .simmaci-btn-primary { background: #10b981; color: #022c22; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; padding: 14px 26px; border-radius: 12px; text-decoration: none; transition: all .25s ease; }
    .simmaci-btn-primary:hover { background: #34d399; transform: translateY(-2px); color: #022c22; }
    .simmaci-btn-secondary { background: rgba(255, 255, 255, 0.1); color: #ffffff; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; padding: 14px 26px; border-radius: 12px; text-decoration: none; border: 1px solid rgba(255, 255, 255, 0.25); transition: all .25s ease; }
    .simmaci-btn-secondary:hover { background: rgba(255, 255, 255, 0.2); transform: translateY(-2px); color: #ffffff; }
    @media (max-width: 640px) { .simmaci-map-banner-card { padding: 30px 18px; } .simmaci-map-content h3 { font-size: 20px; } .simmaci-btn-primary, .simmaci-btn-secondary { width: 100%; text-align: center; } }
    </style>
    <?php
    return ob_get_clean();
}
add_shortcode('simmaci_peta', 'simmaci_peta_shortcode');
