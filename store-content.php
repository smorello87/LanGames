<?php
/**
 * Content Storage API
 * Stores generated game content and returns a short ID for sharing
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
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
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://';
    $baseDir = dirname($_SERVER['REQUEST_URI']);
    $baseURL = $protocol . $_SERVER['HTTP_HOST'] . rtrim($baseDir, '/');

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
