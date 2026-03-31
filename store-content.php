<?php
/**
 * Content Storage API
 * Stores generated game content and returns a short ID for sharing
 */

header('Content-Type: application/json');
$allowedOrigins = ['https://stefanomorello.com', 'http://localhost:8765', 'http://127.0.0.1:8765'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: https://stefanomorello.com');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuration
$CONTENT_DIR = __DIR__ . '/content/';
$MAX_AGE_DAYS = 365; // 1 year expiration
$MAX_FILE_SIZE = 50000; // 50KB max

// Ensure content directory exists
if (!is_dir($CONTENT_DIR)) {
    if (!mkdir($CONTENT_DIR, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Cannot create storage directory']);
        exit();
    }
}

// Simple rate limiting by IP (max 10 stores per hour)
$rateLimitDir = $CONTENT_DIR . '.ratelimit/';
if (!is_dir($rateLimitDir)) {
    mkdir($rateLimitDir, 0755, true);
}
$clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitFile = $rateLimitDir . md5($clientIP) . '.json';
$rateLimit = ['count' => 0, 'reset' => time() + 3600];
if (file_exists($rateLimitFile)) {
    $rateLimit = json_decode(file_get_contents($rateLimitFile), true) ?: $rateLimit;
    if ($rateLimit['reset'] < time()) {
        $rateLimit = ['count' => 0, 'reset' => time() + 3600];
    }
}
if ($rateLimit['count'] >= 10) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit exceeded. Try again later.']);
    exit();
}
$rateLimit['count']++;
file_put_contents($rateLimitFile, json_encode($rateLimit));

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit();
}

// Read and validate input
$input = file_get_contents('php://input');
if (strlen($input) > $MAX_FILE_SIZE) {
    http_response_code(413);
    echo json_encode(['error' => 'Content too large (max 50KB)']);
    exit();
}

$content = json_decode($input, true);
if (!$content) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit();
}

// Validate required fields
if (!isset($content['language']) || !isset($content['difficulty'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid content: missing language or difficulty']);
    exit();
}

/**
 * Generate a unique alphanumeric ID
 */
function generateId($length = 8) {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $id = '';
    for ($i = 0; $i < $length; $i++) {
        $id .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $id;
}

// Generate unique ID (retry if collision)
$id = generateId(8);
$filename = $CONTENT_DIR . $id . '.json';
$attempts = 0;
$maxAttempts = 10;

while (file_exists($filename) && $attempts < $maxAttempts) {
    $id = generateId(8);
    $filename = $CONTENT_DIR . $id . '.json';
    $attempts++;
}

if ($attempts >= $maxAttempts) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to generate unique ID']);
    exit();
}

// Add metadata for expiration tracking
$content['_meta'] = [
    'id' => $id,
    'stored' => date('c'),
    'expires' => date('c', strtotime("+{$MAX_AGE_DAYS} days"))
];

// Save content
if (file_put_contents($filename, json_encode($content, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT))) {
    // Build the share URL
    // Use canonical base URL to prevent Host header injection
    $isLocal = in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost:8765', '127.0.0.1:8765'], true);
    $baseURL = $isLocal
        ? 'http://' . $_SERVER['HTTP_HOST'] . rtrim(dirname($_SERVER['REQUEST_URI']), '/')
        : 'https://stefanomorello.com/langames';

    echo json_encode([
        'success' => true,
        'id' => $id,
        'url' => $baseURL . '/index.html?id=' . $id,
        'expires' => $MAX_AGE_DAYS . ' days',
        'expiresDate' => date('Y-m-d', strtotime("+{$MAX_AGE_DAYS} days"))
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save content']);
}
?>
